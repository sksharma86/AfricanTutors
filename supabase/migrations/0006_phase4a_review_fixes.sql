-- =============================================================================
-- African Tutors — Phase 4A review fixes (on top of 0005)
-- =============================================================================
-- 1. Robust Stripe webhook event lifecycle (processing/completed/failed) so an
--    event is only "done" after fulfillment succeeds; failed/incomplete events
--    are retryable; concurrent duplicate deliveries can't double-fulfill.
-- 2. Idempotency references on ledgers are NOT NULL + non-blank (schema + fn).
-- 3. record_tutor_earning derives tutor + duration from the authoritative
--    booking (no caller-supplied tutor/duration).
-- 4. Financial FKs no longer CASCADE on profile deletion (RESTRICT) so
--    financial history cannot be silently destroyed.
-- Idempotent.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- (1) Stripe event lifecycle
-- ---------------------------------------------------------------------------
alter table public.stripe_events add column if not exists status text not null default 'completed';
alter table public.stripe_events add column if not exists attempts integer not null default 0;
alter table public.stripe_events add column if not exists last_error text;
alter table public.stripe_events add column if not exists updated_at timestamptz not null default now();
alter table public.stripe_events add column if not exists completed_at timestamptz;
alter table public.stripe_events drop constraint if exists stripe_events_status_check;
alter table public.stripe_events add constraint stripe_events_status_check
  check (status in ('processing','completed','failed'));

-- Old single-shot function is replaced by the lifecycle below.
drop function if exists public.mark_stripe_event_processed(text, text);

-- Claim an event for processing. Returns:
--   'claimed'      → caller owns fulfillment (new event, or reclaiming a prior 'failed')
--   'duplicate'    → already 'completed' (safe no-op)
--   'in_progress'  → another delivery is currently processing (caller must not fulfill)
--
-- Concurrency: the unique PK on stripe_events.id makes the INSERT the single
-- claim point. Two simultaneous deliveries of a NEW event both attempt INSERT;
-- exactly one succeeds ('claimed'); the other blocks on the unique index until
-- the first commits, then evaluates ON CONFLICT DO UPDATE (which only reclaims a
-- 'failed' row) — sees 'processing', updates nothing, and returns 'in_progress'.
-- A completed event returns 'duplicate'; a previously 'failed' event is reclaimed.
create or replace function public.begin_stripe_event(p_id text, p_type text)
returns text language plpgsql security definer set search_path = public as $$
declare v_status text;
begin
  if not public.is_financial_actor() then raise exception 'Not authorized'; end if;
  insert into public.stripe_events (id, type, status, attempts)
  values (p_id, p_type, 'processing', 1)
  on conflict (id) do update
     set status = 'processing', attempts = public.stripe_events.attempts + 1, updated_at = now()
   where public.stripe_events.status = 'failed'
  returning status into v_status;
  if found then
    return 'claimed';
  end if;
  select status into v_status from public.stripe_events where id = p_id;
  if v_status = 'completed' then
    return 'duplicate';
  end if;
  return 'in_progress';
end;
$$;

create or replace function public.complete_stripe_event(p_id text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_financial_actor() then raise exception 'Not authorized'; end if;
  update public.stripe_events
     set status = 'completed', completed_at = now(), updated_at = now(), last_error = null
   where id = p_id;
end;
$$;

create or replace function public.fail_stripe_event(p_id text, p_error text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_financial_actor() then raise exception 'Not authorized'; end if;
  update public.stripe_events
     set status = 'failed', last_error = p_error, updated_at = now()
   where id = p_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- (2) Ledger idempotency references: NOT NULL + non-blank
-- ---------------------------------------------------------------------------
alter table public.package_minute_ledger alter column reference set not null;
alter table public.dollar_credit_ledger  alter column reference set not null;
alter table public.package_minute_ledger drop constraint if exists package_minute_ledger_reference_not_blank;
alter table public.package_minute_ledger add constraint package_minute_ledger_reference_not_blank
  check (btrim(reference) <> '');
alter table public.dollar_credit_ledger drop constraint if exists dollar_credit_ledger_reference_not_blank;
alter table public.dollar_credit_ledger add constraint dollar_credit_ledger_reference_not_blank
  check (btrim(reference) <> '');

-- Reject null/blank references inside the mutation functions too (schema + fn agree).
create or replace function public.issue_package_minutes(
  p_account uuid, p_minutes integer, p_reference text,
  p_payment_id uuid default null, p_package_product_id uuid default null, p_reason text default null
) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_financial_actor() then raise exception 'Not authorized'; end if;
  if p_reference is null or btrim(p_reference) = '' then raise exception 'reference is required'; end if;
  if p_minutes <= 0 then raise exception 'minutes must be positive'; end if;
  insert into public.package_minute_ledger (account_id, minutes_delta, entry_type, payment_id, package_product_id, reason, reference, created_by)
  values (p_account, p_minutes, 'purchase', p_payment_id, p_package_product_id, p_reason, p_reference, auth.uid())
  on conflict (reference) do nothing;
  return found;
end;
$$;

create or replace function public.consume_package_minutes(
  p_account uuid, p_minutes integer, p_booking_id uuid, p_reference text, p_reason text default null
) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_bal integer;
begin
  if not public.is_financial_actor() then raise exception 'Not authorized'; end if;
  if p_reference is null or btrim(p_reference) = '' then raise exception 'reference is required'; end if;
  if p_minutes <= 0 then raise exception 'minutes must be positive'; end if;
  perform pg_advisory_xact_lock(hashtext('pkgmin:' || p_account::text));
  v_bal := coalesce((select sum(minutes_delta) from public.package_minute_ledger where account_id = p_account), 0);
  if v_bal < p_minutes then raise exception 'Insufficient package minutes'; end if;
  insert into public.package_minute_ledger (account_id, minutes_delta, entry_type, booking_id, reason, reference, created_by)
  values (p_account, -p_minutes, 'consumption', p_booking_id, p_reason, p_reference, auth.uid())
  on conflict (reference) do nothing;
  return found;
end;
$$;

create or replace function public.restore_package_minutes(
  p_account uuid, p_minutes integer, p_booking_id uuid, p_reference text, p_reason text default null
) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_financial_actor() then raise exception 'Not authorized'; end if;
  if p_reference is null or btrim(p_reference) = '' then raise exception 'reference is required'; end if;
  if p_minutes <= 0 then raise exception 'minutes must be positive'; end if;
  insert into public.package_minute_ledger (account_id, minutes_delta, entry_type, booking_id, reason, reference, created_by)
  values (p_account, p_minutes, 'restoration', p_booking_id, p_reason, p_reference, auth.uid())
  on conflict (reference) do nothing;
  return found;
end;
$$;

create or replace function public.issue_dollar_credit(
  p_account uuid, p_amount_cents integer, p_entry_type text, p_reference text,
  p_reason text default null, p_payment_id uuid default null, p_booking_id uuid default null
) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_financial_actor() then raise exception 'Not authorized'; end if;
  if p_reference is null or btrim(p_reference) = '' then raise exception 'reference is required'; end if;
  if p_amount_cents <= 0 then raise exception 'amount must be positive'; end if;
  if p_entry_type not in ('issuance','restoration','refund','admin_adjustment','promotion','referral') then
    raise exception 'invalid issuance entry_type';
  end if;
  insert into public.dollar_credit_ledger (account_id, amount_cents, entry_type, payment_id, booking_id, reason, reference, created_by)
  values (p_account, p_amount_cents, p_entry_type, p_payment_id, p_booking_id, p_reason, p_reference, auth.uid())
  on conflict (reference) do nothing;
  return found;
end;
$$;

create or replace function public.consume_dollar_credit(
  p_account uuid, p_amount_cents integer, p_reference text, p_reason text default null, p_booking_id uuid default null, p_payment_id uuid default null
) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_bal integer;
begin
  if not public.is_financial_actor() then raise exception 'Not authorized'; end if;
  if p_reference is null or btrim(p_reference) = '' then raise exception 'reference is required'; end if;
  if p_amount_cents <= 0 then raise exception 'amount must be positive'; end if;
  perform pg_advisory_xact_lock(hashtext('dollar:' || p_account::text));
  v_bal := coalesce((select sum(amount_cents) from public.dollar_credit_ledger where account_id = p_account), 0);
  if v_bal < p_amount_cents then raise exception 'Insufficient account credit'; end if;
  insert into public.dollar_credit_ledger (account_id, amount_cents, entry_type, booking_id, payment_id, reason, reference, created_by)
  values (p_account, -p_amount_cents, 'consumption', p_booking_id, p_payment_id, p_reason, p_reference, auth.uid())
  on conflict (reference) do nothing;
  return found;
end;
$$;

-- ---------------------------------------------------------------------------
-- (3) record_tutor_earning derives tutor + duration from the booking.
-- ---------------------------------------------------------------------------
drop function if exists public.record_tutor_earning(uuid, uuid, integer, text);

create or replace function public.record_tutor_earning(p_booking uuid, p_reason text default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_tutor uuid; v_duration integer; v_rate integer; v_amount integer; v_id uuid;
begin
  if not public.is_financial_actor() then raise exception 'Not authorized'; end if;
  select tutor_id, duration_minutes into v_tutor, v_duration
  from public.bookings where id = p_booking;
  if not found then raise exception 'Booking not found'; end if;
  if v_tutor is null then raise exception 'Booking has no assigned tutor'; end if;
  if v_duration is null or v_duration <= 0 then raise exception 'Booking has no valid duration'; end if;
  select comp_rate_cents_per_hour into v_rate from public.tutor_profiles where profile_id = v_tutor;
  if v_rate is null then raise exception 'Tutor compensation rate is not set'; end if;
  v_amount := round(v_rate::numeric * v_duration / 60.0)::integer;
  insert into public.tutor_earnings (tutor_id, booking_id, duration_minutes, rate_cents_per_hour, amount_cents, status, earned_at, reason, created_by)
  values (v_tutor, p_booking, v_duration, v_rate, v_amount, 'earned', now(), p_reason, auth.uid())
  on conflict (booking_id) do nothing
  returning id into v_id;
  return v_id;  -- null if an earning already existed for this booking (idempotent)
end;
$$;

-- ---------------------------------------------------------------------------
-- (4) Preserve financial history: do not CASCADE on profile deletion.
--     RESTRICT means an account/tutor with financial records cannot be
--     physically deleted (use a soft-delete/anonymize path instead) — the
--     ledger/payment/earning history is never silently destroyed.
-- ---------------------------------------------------------------------------
alter table public.payments drop constraint if exists payments_account_id_fkey;
alter table public.payments add constraint payments_account_id_fkey
  foreign key (account_id) references public.profiles (id) on delete restrict;
alter table public.package_minute_ledger drop constraint if exists package_minute_ledger_account_id_fkey;
alter table public.package_minute_ledger add constraint package_minute_ledger_account_id_fkey
  foreign key (account_id) references public.profiles (id) on delete restrict;
alter table public.dollar_credit_ledger drop constraint if exists dollar_credit_ledger_account_id_fkey;
alter table public.dollar_credit_ledger add constraint dollar_credit_ledger_account_id_fkey
  foreign key (account_id) references public.profiles (id) on delete restrict;
alter table public.tutor_earnings drop constraint if exists tutor_earnings_tutor_id_fkey;
alter table public.tutor_earnings add constraint tutor_earnings_tutor_id_fkey
  foreign key (tutor_id) references public.profiles (id) on delete restrict;

-- ---------------------------------------------------------------------------
-- Grants for new/replaced functions
-- ---------------------------------------------------------------------------
do $$
declare fn text;
begin
  for fn in select unnest(array[
    'begin_stripe_event(text,text)','complete_stripe_event(text)','fail_stripe_event(text,text)',
    'record_tutor_earning(uuid,text)'
  ]) loop
    execute format('revoke all on function public.%s from public', fn);
    execute format('grant execute on function public.%s to authenticated, service_role', fn);
  end loop;
end $$;

notify pgrst, 'reload schema';
