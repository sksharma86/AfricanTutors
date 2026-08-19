-- =============================================================================
-- African Tutors — Phase 4C: admin financial ops, earnings, cancellations,
-- refunds, and internal disputes
-- =============================================================================
-- Operational/admin layer on top of the 4A/4B foundation. Everything here is a
-- SECURITY DEFINER function that does its OWN authorization (owner for customer
-- actions; is_admin for admin actions) and writes financial_audit_log. All money
-- is integer cents. All mutations are idempotent via unique references / status
-- guards. No Stripe Connect / payouts (manual), no subscriptions/promo/referral.
-- Idempotent migration.
-- =============================================================================

-- Minimal placeholder for future session-recording integration (Phase 4D+).
alter table public.bookings add column if not exists recording_ref text;

-- ---------------------------------------------------------------------------
-- refunds — auditable Stripe cash-refund records (distinct from account credit).
-- ---------------------------------------------------------------------------
create table if not exists public.refunds (
  id               uuid primary key default gen_random_uuid(),
  payment_id       uuid not null references public.payments (id) on delete restrict,
  account_id       uuid not null references public.profiles (id) on delete restrict,
  amount_cents     integer not null check (amount_cents > 0),
  stripe_refund_id text unique,
  reason           text,
  created_by       uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now()
);
create index if not exists refunds_payment_idx on public.refunds (payment_id);

-- ---------------------------------------------------------------------------
-- disputes — internal arbitration tied to a booking. Admin-only base table;
-- customers read a safe projection via get_my_disputes() (admin_notes hidden).
-- ---------------------------------------------------------------------------
create table if not exists public.disputes (
  id                uuid primary key default gen_random_uuid(),
  booking_id        uuid not null references public.bookings (id) on delete cascade,
  account_id        uuid not null references public.profiles (id) on delete restrict,
  tutor_id          uuid references public.profiles (id) on delete set null,
  category          text not null,
  complaint         text,
  status            text not null default 'open' check (status in ('open','under_review','resolved','denied')),
  resolution        text check (resolution in ('denied','courtesy','upheld')),
  admin_notes       text,
  financial_actions jsonb,
  created_at        timestamptz not null default now(),
  reviewed_at       timestamptz,
  reviewed_by       uuid references public.profiles (id) on delete set null
);
create index if not exists disputes_status_idx on public.disputes (status);
-- At most one *active* dispute per booking.
create unique index if not exists disputes_active_one_per_booking
  on public.disputes (booking_id) where status in ('open','under_review');

-- ---------------------------------------------------------------------------
-- Internal helper: append a financial/admin audit record.
-- ---------------------------------------------------------------------------
create or replace function public.log_admin_action(
  p_action text, p_entity_type text, p_entity_id uuid,
  p_prev jsonb, p_new jsonb, p_reason text
) returns void language sql security definer set search_path = public as $$
  insert into public.financial_audit_log (actor_id, action, entity_type, entity_id, previous_state, new_state, reason)
  values (auth.uid(), p_action, p_entity_type, p_entity_id, p_prev, p_new, p_reason);
$$;

-- ---------------------------------------------------------------------------
-- Internal: record a full tutor earning for a booking (rate snapshot, one per
-- booking). No is_financial_actor guard — callers below authorize themselves and
-- run as DEFINER, so a customer's late-cancel can still pay the tutor.
-- ---------------------------------------------------------------------------
create or replace function public.record_full_earning(p_booking uuid, p_reason text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_tutor uuid; v_duration int; v_rate int; v_amount int; v_id uuid;
begin
  select tutor_id, duration_minutes into v_tutor, v_duration from public.bookings where id = p_booking;
  if v_tutor is null then raise exception 'Booking has no assigned tutor'; end if;
  if v_duration is null or v_duration <= 0 then raise exception 'Booking has no valid duration'; end if;
  select comp_rate_cents_per_hour into v_rate from public.tutor_profiles where profile_id = v_tutor;
  if v_rate is null then raise exception 'Tutor compensation rate is not set'; end if;
  v_amount := round(v_rate::numeric * v_duration / 60.0)::integer;
  insert into public.tutor_earnings (tutor_id, booking_id, duration_minutes, rate_cents_per_hour, amount_cents, status, earned_at, reason, created_by)
  values (v_tutor, p_booking, v_duration, v_rate, v_amount, 'earned', now(), p_reason, auth.uid())
  on conflict (booking_id) do nothing
  returning id into v_id;
  return v_id;
end;
$$;

-- Best-effort full earning: never aborts the surrounding booking-state change if
-- the tutor rate is missing; defers with an audit note instead.
create or replace function public.try_full_earning(p_booking uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.record_full_earning(p_booking, p_reason);
exception when others then
  perform public.log_admin_action('earning_deferred', 'bookings', p_booking, null, null,
    'Could not record tutor earning: ' || SQLERRM);
end;
$$;

-- ---------------------------------------------------------------------------
-- Internal: restore the value used to fund a booking. Package-funded bookings
-- restore minutes; credit/Stripe-funded bookings restore the FULL booking value
-- (credit + Stripe) as account credit. Idempotent per booking.
-- ---------------------------------------------------------------------------
create or replace function public.restore_booking_value(p_booking uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_account uuid; v_pkg int; v_pay record; v_restore int;
begin
  select account_id into v_account from public.bookings where id = p_booking;
  select coalesce(-sum(minutes_delta), 0) into v_pkg
    from public.package_minute_ledger where booking_id = p_booking and entry_type = 'consumption';
  if v_pkg > 0 then
    insert into public.package_minute_ledger (account_id, minutes_delta, entry_type, booking_id, reason, reference, created_by)
    values (v_account, v_pkg, 'restoration', p_booking, p_reason, 'cancel:pkg:' || p_booking::text, auth.uid())
    on conflict (reference) do nothing;
    return jsonb_build_object('restored_minutes', v_pkg);
  end if;

  select * into v_pay from public.payments
   where booking_id = p_booking and purpose = 'booking' and status = 'succeeded'
   order by created_at desc limit 1;
  if v_pay.id is not null then
    v_restore := v_pay.credit_applied_cents + v_pay.stripe_paid_cents;
    if v_restore > 0 then
      insert into public.dollar_credit_ledger (account_id, amount_cents, entry_type, payment_id, booking_id, reason, reference, created_by)
      values (v_account, v_restore, 'restoration', v_pay.id, p_booking, p_reason, 'cancel:credit:' || p_booking::text, auth.uid())
      on conflict (reference) do nothing;
    end if;
    return jsonb_build_object('restored_credit_cents', v_restore);
  end if;
  return jsonb_build_object('restored', 0);
end;
$$;

-- ===========================================================================
-- CUSTOMER CANCELLATION (24-hour rule; server determines timing)
-- ===========================================================================
create or replace function public.customer_cancel_booking(p_booking uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_account uuid; v_caller uuid := auth.uid(); v_status public.booking_status; v_start timestamptz; v_early boolean; v_res jsonb;
begin
  select account_id, status, scheduled_start into v_account, v_status, v_start
    from public.bookings where id = p_booking for update;
  if v_account is null then raise exception 'Booking not found'; end if;
  if v_caller is distinct from v_account and not public.is_admin(v_caller) then
    raise exception 'Not authorized';
  end if;
  if v_status not in ('pending', 'confirmed') then
    return jsonb_build_object('status', 'noop', 'booking_status', v_status::text);
  end if;

  v_early := (v_start is null) or (v_start - now() >= interval '24 hours');
  if v_early then
    v_res := public.restore_booking_value(p_booking, 'customer cancellation 24h+ — value restored');
    update public.bookings set status = 'cancelled', cancelled_at = now() where id = p_booking;
  else
    update public.bookings set status = 'cancelled', cancelled_at = now() where id = p_booking;
    perform public.try_full_earning(p_booking, 'late customer cancellation (<24h) — full tutor compensation');
    v_res := jsonb_build_object('restored', 0);
  end if;

  perform public.log_admin_action('customer_cancel_booking', 'bookings', p_booking,
    jsonb_build_object('status', v_status::text),
    jsonb_build_object('status', 'cancelled', 'early', v_early) || v_res,
    case when v_early then 'early cancellation (value restored)' else 'late cancellation (forfeit; tutor paid)' end);
  return jsonb_build_object('status', 'cancelled', 'early', v_early) || v_res;
end;
$$;

-- ===========================================================================
-- ADMIN BOOKING OPERATIONS
-- ===========================================================================
create or replace function public.admin_no_show(p_booking uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_status public.booking_status;
begin
  if not public.is_admin(auth.uid()) then raise exception 'Not authorized'; end if;
  select status into v_status from public.bookings where id = p_booking for update;
  if v_status is null then raise exception 'Booking not found'; end if;
  if v_status not in ('pending', 'confirmed') then
    return jsonb_build_object('status', 'noop', 'booking_status', v_status::text);
  end if;
  update public.bookings set status = 'no_show' where id = p_booking;
  perform public.try_full_earning(p_booking, 'customer no-show — full tutor compensation');
  perform public.log_admin_action('no_show', 'bookings', p_booking,
    jsonb_build_object('status', v_status::text), jsonb_build_object('status', 'no_show'), 'customer no-show');
  return jsonb_build_object('status', 'no_show');
end;
$$;

create or replace function public.admin_complete_booking(p_booking uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_status public.booking_status;
begin
  if not public.is_admin(auth.uid()) then raise exception 'Not authorized'; end if;
  select status into v_status from public.bookings where id = p_booking for update;
  if v_status is null then raise exception 'Booking not found'; end if;
  if v_status = 'completed' then return jsonb_build_object('status', 'noop'); end if;
  if v_status not in ('pending', 'confirmed') then
    raise exception 'Cannot complete a % booking', v_status;
  end if;
  update public.bookings set status = 'completed', completed_at = now() where id = p_booking;
  perform public.try_full_earning(p_booking, 'session completed — full tutor compensation');
  perform public.log_admin_action('complete_booking', 'bookings', p_booking,
    jsonb_build_object('status', v_status::text), jsonb_build_object('status', 'completed'), 'session completed');
  return jsonb_build_object('status', 'completed');
end;
$$;

-- Company/admin cancellation OR unreassigned tutor cancellation: restore all
-- customer value + optional courtesy credit; tutor earns $0 (no earning created).
create or replace function public.admin_release_booking(
  p_booking uuid, p_reason text, p_comp_credit_cents integer default 0
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_account uuid; v_status public.booking_status; v_res jsonb;
begin
  if not public.is_admin(auth.uid()) then raise exception 'Not authorized'; end if;
  if p_comp_credit_cents < 0 then raise exception 'comp credit must be >= 0'; end if;
  select account_id, status into v_account, v_status from public.bookings where id = p_booking for update;
  if v_account is null then raise exception 'Booking not found'; end if;
  if v_status not in ('pending', 'confirmed') then
    return jsonb_build_object('status', 'noop', 'booking_status', v_status::text);
  end if;

  v_res := public.restore_booking_value(p_booking, coalesce(p_reason, 'booking released — value restored'));
  if p_comp_credit_cents > 0 then
    insert into public.dollar_credit_ledger (account_id, amount_cents, entry_type, booking_id, reason, reference, created_by)
    values (v_account, p_comp_credit_cents, 'issuance', p_booking, coalesce(p_reason, 'courtesy compensation'), 'comp:' || p_booking::text, auth.uid())
    on conflict (reference) do nothing;
  end if;
  update public.bookings set status = 'cancelled', cancelled_at = now() where id = p_booking;

  perform public.log_admin_action('admin_release_booking', 'bookings', p_booking,
    jsonb_build_object('status', v_status::text),
    jsonb_build_object('status', 'cancelled', 'comp_credit_cents', p_comp_credit_cents) || v_res, p_reason);
  return jsonb_build_object('status', 'cancelled', 'comp_credit_cents', p_comp_credit_cents) || v_res;
end;
$$;

-- Tutor reassignment: validate eligibility + availability, switch tutor. The
-- authoritative tutor for later earnings becomes the new tutor; no earning is
-- created here, so the original tutor does not retain earnings by assignment.
create or replace function public.admin_reassign_tutor(p_booking uuid, p_new_tutor uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_bk record; v_tz text; v_name text; v_ok boolean;
begin
  if not public.is_admin(auth.uid()) then raise exception 'Not authorized'; end if;
  select * into v_bk from public.bookings where id = p_booking for update;
  if v_bk.id is null then raise exception 'Booking not found'; end if;
  if v_bk.subject_id is null or v_bk.scheduled_start is null then
    raise exception 'Only scheduled subject bookings can be reassigned';
  end if;
  if v_bk.status not in ('pending', 'confirmed') then raise exception 'Cannot reassign a % booking', v_bk.status; end if;
  if p_new_tutor = v_bk.tutor_id then raise exception 'Already assigned to that tutor'; end if;

  -- eligibility: approved tutor qualified for the subject
  select coalesce(tp.timezone, 'Africa/Lagos'), pr.display_name into v_tz, v_name
    from public.tutor_profiles tp join public.profiles pr on pr.id = tp.profile_id
   where tp.profile_id = p_new_tutor and tp.status = 'approved' and pr.role = 'tutor';
  if v_tz is null then raise exception 'Replacement tutor is not an approved tutor'; end if;
  if not exists (select 1 from public.tutor_subjects where tutor_id = p_new_tutor and subject_id = v_bk.subject_id) then
    raise exception 'Replacement tutor is not approved for this subject';
  end if;
  -- availability / no conflict at the scheduled window
  v_ok := public.tutor_is_available(p_new_tutor, v_tz, v_bk.scheduled_start, v_bk.scheduled_end);
  if not v_ok then raise exception 'Replacement tutor is not available for that time'; end if;

  update public.bookings set tutor_id = p_new_tutor, tutor_display_name = v_name where id = p_booking;
  perform public.log_admin_action('reassign_tutor', 'bookings', p_booking,
    jsonb_build_object('tutor_id', v_bk.tutor_id), jsonb_build_object('tutor_id', p_new_tutor), p_reason);
  return jsonb_build_object('status', 'reassigned', 'from_tutor', v_bk.tutor_id, 'to_tutor', p_new_tutor);
end;
$$;

-- ===========================================================================
-- ADMIN CREDIT / MINUTE ADJUSTMENTS (prevent invalid negative balances)
-- ===========================================================================
create or replace function public.admin_adjust_dollar_credit(
  p_account uuid, p_amount_cents integer, p_reason text, p_reference text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_bal int; v_new_ref boolean;
begin
  if not public.is_admin(auth.uid()) then raise exception 'Not authorized'; end if;
  if p_amount_cents = 0 then raise exception 'amount must be non-zero'; end if;
  if p_reference is null or btrim(p_reference) = '' then raise exception 'reference is required'; end if;
  perform pg_advisory_xact_lock(hashtext('dollar:' || p_account::text));
  v_bal := coalesce((select sum(amount_cents) from public.dollar_credit_ledger where account_id = p_account), 0);
  if p_amount_cents < 0 and v_bal + p_amount_cents < 0 then
    raise exception 'Adjustment would create a negative balance (have %, adjust %)', v_bal, p_amount_cents;
  end if;
  insert into public.dollar_credit_ledger (account_id, amount_cents, entry_type, reason, reference, created_by)
  values (p_account, p_amount_cents, 'admin_adjustment', p_reason, p_reference, auth.uid())
  on conflict (reference) do nothing;
  get diagnostics v_new_ref = row_count;
  if v_new_ref then
    perform public.log_admin_action('adjust_dollar_credit', 'profiles', p_account, null,
      jsonb_build_object('amount_cents', p_amount_cents, 'reference', p_reference), p_reason);
  end if;
  return jsonb_build_object('applied', v_new_ref, 'balance_cents',
    coalesce((select sum(amount_cents) from public.dollar_credit_ledger where account_id = p_account), 0));
end;
$$;

create or replace function public.admin_adjust_package_minutes(
  p_account uuid, p_minutes integer, p_reason text, p_reference text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_bal int; v_new_ref boolean;
begin
  if not public.is_admin(auth.uid()) then raise exception 'Not authorized'; end if;
  if p_minutes = 0 then raise exception 'minutes must be non-zero'; end if;
  if p_reference is null or btrim(p_reference) = '' then raise exception 'reference is required'; end if;
  perform pg_advisory_xact_lock(hashtext('pkgmin:' || p_account::text));
  v_bal := coalesce((select sum(minutes_delta) from public.package_minute_ledger where account_id = p_account), 0);
  if p_minutes < 0 and v_bal + p_minutes < 0 then
    raise exception 'Adjustment would create negative minutes (have %, adjust %)', v_bal, p_minutes;
  end if;
  insert into public.package_minute_ledger (account_id, minutes_delta, entry_type, reason, reference, created_by)
  values (p_account, p_minutes, 'admin_adjustment', p_reason, p_reference, auth.uid())
  on conflict (reference) do nothing;
  get diagnostics v_new_ref = row_count;
  if v_new_ref then
    perform public.log_admin_action('adjust_package_minutes', 'profiles', p_account, null,
      jsonb_build_object('minutes', p_minutes, 'reference', p_reference), p_reason);
  end if;
  return jsonb_build_object('applied', v_new_ref, 'balance_minutes',
    coalesce((select sum(minutes_delta) from public.package_minute_ledger where account_id = p_account), 0));
end;
$$;

-- ===========================================================================
-- STRIPE REFUNDS (record + reconcile; the Stripe API call is made server-side
-- in the route, which passes the resulting stripe_refund_id here).
-- ===========================================================================
create or replace function public.admin_record_refund(
  p_payment_id uuid, p_amount_cents integer, p_stripe_refund_id text, p_reason text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_pay record; v_refundable int; v_new_ref boolean; v_total_refunded int;
begin
  if not public.is_admin(auth.uid()) then raise exception 'Not authorized'; end if;
  if p_amount_cents is null or p_amount_cents <= 0 then raise exception 'refund amount must be positive'; end if;
  if p_stripe_refund_id is null or btrim(p_stripe_refund_id) = '' then raise exception 'stripe_refund_id is required'; end if;

  select * into v_pay from public.payments where id = p_payment_id for update;
  if v_pay.id is null then raise exception 'Payment not found'; end if;

  -- Idempotency first: a refund already recorded under this Stripe id is a safe
  -- no-op (checked BEFORE the refundable guard, since the amount is already
  -- reflected in refunded_cents).
  if exists (select 1 from public.refunds where stripe_refund_id = p_stripe_refund_id) then
    return jsonb_build_object('applied', false, 'refunded_cents', v_pay.refunded_cents);
  end if;

  v_refundable := v_pay.stripe_paid_cents - v_pay.refunded_cents;
  if p_amount_cents > v_refundable then
    raise exception 'Refund exceeds refundable Stripe amount (refundable %, requested %)', v_refundable, p_amount_cents;
  end if;

  insert into public.refunds (payment_id, account_id, amount_cents, stripe_refund_id, reason, created_by)
  values (p_payment_id, v_pay.account_id, p_amount_cents, p_stripe_refund_id, p_reason, auth.uid())
  on conflict (stripe_refund_id) do nothing;
  get diagnostics v_new_ref = row_count;

  if v_new_ref then
    v_total_refunded := v_pay.refunded_cents + p_amount_cents;
    update public.payments
       set refunded_cents = v_total_refunded,
           status = case when v_total_refunded >= stripe_paid_cents and stripe_paid_cents > 0 then 'refunded'
                         when v_total_refunded > 0 then 'partially_refunded' else status end
     where id = p_payment_id;
    perform public.log_admin_action('refund', 'payments', p_payment_id,
      jsonb_build_object('refunded_cents', v_pay.refunded_cents),
      jsonb_build_object('refunded_cents', v_total_refunded, 'stripe_refund_id', p_stripe_refund_id), p_reason);
  end if;

  return jsonb_build_object('applied', v_new_ref, 'refunded_cents',
    (select refunded_cents from public.payments where id = p_payment_id));
end;
$$;

-- ===========================================================================
-- TUTOR EARNINGS ADMIN LIFECYCLE
-- ===========================================================================
create or replace function public.admin_mark_earning_paid(p_earning_id uuid, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_e record;
begin
  if not public.is_admin(auth.uid()) then raise exception 'Not authorized'; end if;
  select * into v_e from public.tutor_earnings where id = p_earning_id for update;
  if v_e.id is null then raise exception 'Earning not found'; end if;
  if v_e.status = 'paid' then return jsonb_build_object('status', 'noop'); end if;
  if v_e.status = 'voided' then raise exception 'Cannot pay a voided earning'; end if;
  update public.tutor_earnings set status = 'paid', paid_at = now(), reason = coalesce(p_note, reason) where id = p_earning_id;
  perform public.log_admin_action('earning_paid', 'tutor_earnings', p_earning_id,
    jsonb_build_object('status', v_e.status), jsonb_build_object('status', 'paid'), p_note);
  return jsonb_build_object('status', 'paid');
end;
$$;

create or replace function public.admin_mark_earnings_paid_batch(p_ids uuid[], p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_paid int := 0;
begin
  if not public.is_admin(auth.uid()) then raise exception 'Not authorized'; end if;
  foreach v_id in array coalesce(p_ids, '{}') loop
    if (select status from public.tutor_earnings where id = v_id) in ('earned', 'adjusted', 'pending') then
      update public.tutor_earnings set status = 'paid', paid_at = now(), reason = coalesce(p_note, reason) where id = v_id;
      perform public.log_admin_action('earning_paid', 'tutor_earnings', v_id, null, jsonb_build_object('status', 'paid'), p_note);
      v_paid := v_paid + 1;
    end if;
  end loop;
  return jsonb_build_object('paid_count', v_paid);
end;
$$;

create or replace function public.admin_adjust_earning(p_earning_id uuid, p_new_amount_cents integer, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_e record;
begin
  if not public.is_admin(auth.uid()) then raise exception 'Not authorized'; end if;
  if p_new_amount_cents < 0 then raise exception 'amount must be >= 0'; end if;
  if p_reason is null or btrim(p_reason) = '' then raise exception 'reason is required'; end if;
  select * into v_e from public.tutor_earnings where id = p_earning_id for update;
  if v_e.id is null then raise exception 'Earning not found'; end if;
  if v_e.status = 'paid' then raise exception 'Cannot adjust an already-paid earning'; end if;
  update public.tutor_earnings
     set amount_cents = p_new_amount_cents,
         adjusted_from_cents = coalesce(adjusted_from_cents, v_e.amount_cents),
         status = 'adjusted', reason = p_reason
   where id = p_earning_id;
  perform public.log_admin_action('earning_adjusted', 'tutor_earnings', p_earning_id,
    jsonb_build_object('amount_cents', v_e.amount_cents, 'status', v_e.status),
    jsonb_build_object('amount_cents', p_new_amount_cents, 'status', 'adjusted'), p_reason);
  return jsonb_build_object('status', 'adjusted', 'amount_cents', p_new_amount_cents);
end;
$$;

create or replace function public.admin_void_earning(p_earning_id uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_e record;
begin
  if not public.is_admin(auth.uid()) then raise exception 'Not authorized'; end if;
  if p_reason is null or btrim(p_reason) = '' then raise exception 'reason is required'; end if;
  select * into v_e from public.tutor_earnings where id = p_earning_id for update;
  if v_e.id is null then raise exception 'Earning not found'; end if;
  if v_e.status = 'paid' then raise exception 'Cannot void an already-paid earning'; end if;
  if v_e.status = 'voided' then return jsonb_build_object('status', 'noop'); end if;
  update public.tutor_earnings set status = 'voided', reason = p_reason where id = p_earning_id;
  perform public.log_admin_action('earning_voided', 'tutor_earnings', p_earning_id,
    jsonb_build_object('status', v_e.status), jsonb_build_object('status', 'voided'), p_reason);
  return jsonb_build_object('status', 'voided');
end;
$$;

create or replace function public.admin_restore_earning(p_earning_id uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_e record;
begin
  if not public.is_admin(auth.uid()) then raise exception 'Not authorized'; end if;
  select * into v_e from public.tutor_earnings where id = p_earning_id for update;
  if v_e.id is null then raise exception 'Earning not found'; end if;
  if v_e.status <> 'voided' then return jsonb_build_object('status', 'noop', 'current', v_e.status); end if;
  update public.tutor_earnings set status = 'earned', reason = p_reason where id = p_earning_id;
  perform public.log_admin_action('earning_restored', 'tutor_earnings', p_earning_id,
    jsonb_build_object('status', 'voided'), jsonb_build_object('status', 'earned'), p_reason);
  return jsonb_build_object('status', 'earned');
end;
$$;

-- ===========================================================================
-- DISPUTES
-- ===========================================================================
create or replace function public.create_dispute(p_booking uuid, p_category text, p_complaint text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_bk record; v_caller uuid := auth.uid(); v_id uuid;
begin
  select * into v_bk from public.bookings where id = p_booking;
  if v_bk.id is null then raise exception 'Booking not found'; end if;
  if v_caller is distinct from v_bk.account_id and not public.is_admin(v_caller) then
    raise exception 'Not authorized';
  end if;
  if v_bk.status not in ('completed', 'no_show', 'confirmed', 'cancelled') then
    raise exception 'This booking is not eligible for a dispute';
  end if;
  if coalesce(btrim(p_category), '') = '' then raise exception 'A category is required'; end if;
  begin
    insert into public.disputes (booking_id, account_id, tutor_id, category, complaint)
    values (p_booking, v_bk.account_id, v_bk.tutor_id, p_category, p_complaint)
    returning id into v_id;
  exception when unique_violation then
    raise exception 'There is already an open dispute for this booking';
  end;
  perform public.log_admin_action('dispute_created', 'disputes', v_id, null,
    jsonb_build_object('booking_id', p_booking, 'category', p_category), 'customer submitted dispute');
  return v_id;
end;
$$;

-- Safe customer-facing projection (no admin_notes / reviewer identity).
create or replace function public.get_my_disputes()
returns table (
  id uuid, booking_id uuid, category text, complaint text, status text,
  resolution text, created_at timestamptz, reviewed_at timestamptz
) language sql stable security definer set search_path = public as $$
  select d.id, d.booking_id, d.category, d.complaint, d.status, d.resolution, d.created_at, d.reviewed_at
  from public.disputes d
  where d.account_id = auth.uid()
  order by d.created_at desc;
$$;

create or replace function public.admin_resolve_dispute(
  p_dispute uuid,
  p_resolution text,                 -- 'denied' | 'courtesy' | 'upheld'
  p_notes text default null,
  p_restore_minutes integer default 0,
  p_credit_cents integer default 0,
  p_refund_payment uuid default null,
  p_refund_cents integer default 0,
  p_refund_stripe_id text default null,
  p_earning_action text default null, -- null | 'void' | 'adjust'
  p_earning_new_cents integer default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_d record; v_actions jsonb := '{}'::jsonb; v_earn record;
begin
  if not public.is_admin(auth.uid()) then raise exception 'Not authorized'; end if;
  if p_resolution not in ('denied', 'courtesy', 'upheld') then raise exception 'Invalid resolution'; end if;
  select * into v_d from public.disputes where id = p_dispute for update;
  if v_d.id is null then raise exception 'Dispute not found'; end if;
  if v_d.status in ('resolved', 'denied') then
    return jsonb_build_object('status', 'noop', 'dispute_status', v_d.status);
  end if;

  if p_restore_minutes > 0 then
    perform public.admin_adjust_package_minutes(v_d.account_id, p_restore_minutes,
      'dispute resolution: minutes restored', 'dispute:' || p_dispute::text || ':minutes');
    v_actions := v_actions || jsonb_build_object('restored_minutes', p_restore_minutes);
  end if;
  if p_credit_cents > 0 then
    perform public.admin_adjust_dollar_credit(v_d.account_id, p_credit_cents,
      'dispute resolution: account credit', 'dispute:' || p_dispute::text || ':credit');
    v_actions := v_actions || jsonb_build_object('credit_cents', p_credit_cents);
  end if;
  if p_refund_payment is not null and p_refund_cents > 0 then
    perform public.admin_record_refund(p_refund_payment, p_refund_cents, p_refund_stripe_id, 'dispute resolution refund');
    v_actions := v_actions || jsonb_build_object('refund_cents', p_refund_cents);
  end if;
  if p_earning_action = 'void' then
    select id into v_earn from public.tutor_earnings where booking_id = v_d.booking_id;
    if v_earn.id is not null then
      perform public.admin_void_earning(v_earn.id, 'dispute resolution: earning voided');
      v_actions := v_actions || jsonb_build_object('earning', 'voided');
    end if;
  elsif p_earning_action = 'adjust' and p_earning_new_cents is not null then
    select id into v_earn from public.tutor_earnings where booking_id = v_d.booking_id;
    if v_earn.id is not null then
      perform public.admin_adjust_earning(v_earn.id, p_earning_new_cents, 'dispute resolution: earning adjusted');
      v_actions := v_actions || jsonb_build_object('earning_adjusted_cents', p_earning_new_cents);
    end if;
  end if;

  update public.disputes
     set status = case when p_resolution = 'denied' then 'denied' else 'resolved' end,
         resolution = p_resolution, admin_notes = p_notes, financial_actions = v_actions,
         reviewed_at = now(), reviewed_by = auth.uid()
   where id = p_dispute;

  perform public.log_admin_action('dispute_resolved', 'disputes', p_dispute,
    jsonb_build_object('status', v_d.status),
    jsonb_build_object('resolution', p_resolution) || v_actions, p_notes);
  return jsonb_build_object('resolution', p_resolution, 'actions', v_actions);
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.refunds  enable row level security;
alter table public.disputes enable row level security;

drop policy if exists refunds_select on public.refunds;
create policy refunds_select on public.refunds for select to authenticated
  using (account_id = auth.uid() or public.is_admin(auth.uid()));

-- Base disputes table: admin read only. Customers use get_my_disputes() (which
-- omits admin_notes / reviewer). No client writes (functions are DEFINER).
drop policy if exists disputes_admin_select on public.disputes;
create policy disputes_admin_select on public.disputes for select to authenticated
  using (public.is_admin(auth.uid()));

grant select on public.refunds to authenticated;
grant select on public.disputes to authenticated;
grant all on public.refunds, public.disputes to service_role;

-- ---------------------------------------------------------------------------
-- Grants for functions (each enforces its own authorization internally).
-- ---------------------------------------------------------------------------
do $$
declare fn text;
begin
  for fn in select unnest(array[
    'log_admin_action(text,text,uuid,jsonb,jsonb,text)',
    'record_full_earning(uuid,text)',
    'try_full_earning(uuid,text)',
    'restore_booking_value(uuid,text)',
    'customer_cancel_booking(uuid)',
    'admin_no_show(uuid)',
    'admin_complete_booking(uuid)',
    'admin_release_booking(uuid,text,integer)',
    'admin_reassign_tutor(uuid,uuid,text)',
    'admin_adjust_dollar_credit(uuid,integer,text,text)',
    'admin_adjust_package_minutes(uuid,integer,text,text)',
    'admin_record_refund(uuid,integer,text,text)',
    'admin_mark_earning_paid(uuid,text)',
    'admin_mark_earnings_paid_batch(uuid[],text)',
    'admin_adjust_earning(uuid,integer,text)',
    'admin_void_earning(uuid,text)',
    'admin_restore_earning(uuid,text)',
    'create_dispute(uuid,text,text)',
    'get_my_disputes()',
    'admin_resolve_dispute(uuid,text,text,integer,integer,uuid,integer,text,text,integer)'
  ]) loop
    execute format('revoke all on function public.%s from public', fn);
    execute format('grant execute on function public.%s to authenticated, service_role', fn);
  end loop;
end $$;

-- Internal helpers should not be directly callable by clients.
revoke execute on function public.log_admin_action(text,text,uuid,jsonb,jsonb,text) from authenticated;
revoke execute on function public.record_full_earning(uuid,text) from authenticated;
revoke execute on function public.try_full_earning(uuid,text) from authenticated;
revoke execute on function public.restore_booking_value(uuid,text) from authenticated;

notify pgrst, 'reload schema';
