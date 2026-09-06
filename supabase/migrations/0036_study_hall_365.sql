-- =============================================================================
-- Study Hall 365 — subscription, à-la-carte 10-pack, daily entitlement
-- =============================================================================
-- Additive financial foundation. Does NOT:
--   * rewrite or expire existing prepaid balances / purchase history
--   * deactivate pkg_14h / pkg_28h (live purchase tests and cutover safety)
--   * credit 365 membership as prepaid minutes
--   * introduce a Stripe subscription trial
--   * change Daily, recording, Call Parent, or booking duration rules
--
-- New customer-facing à-la-carte SKU is pkg_10sh (600 minutes / $100).
-- Historical pkg_10h (600 minutes / $190, inactive) is left untouched.
--
-- Study Hall 365 is a daily entitlement during the paid membership window,
-- not a bucket of 30/31 credits. Unused days do not roll over.
-- Idempotent. Not wrapped in BEGIN/COMMIT (SQL Editor applies independently).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Account timezone (optional override). NULL = unset.
-- Resolver: profile.timezone → first student timezone → America/Chicago.
-- Clients cannot change this column (see guard_profile_privileges).
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists timezone text;

create or replace function public.guard_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role
     and auth.uid() is not null
     and not public.is_admin(auth.uid()) then
    raise exception 'Not authorized to change role';
  end if;
  if new.stripe_customer_id is distinct from old.stripe_customer_id
     and auth.uid() is not null
     and not public.is_admin(auth.uid()) then
    raise exception 'Not authorized to change billing identity';
  end if;
  if new.timezone is distinct from old.timezone
     and auth.uid() is not null
     and not public.is_admin(auth.uid()) then
    raise exception 'Not authorized to change account timezone';
  end if;
  new.id := old.id;
  new.created_at := old.created_at;
  return new;
end;
$$;

create or replace function public.resolve_account_timezone(p_account uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tz text;
begin
  if p_account is null then
    return 'America/Chicago';
  end if;
  select nullif(btrim(timezone), '') into v_tz
    from public.profiles where id = p_account;
  if v_tz is not null then
    return v_tz;
  end if;
  select nullif(btrim(timezone), '') into v_tz
    from public.students
   where account_id = p_account
   order by created_at asc
   limit 1;
  return coalesce(v_tz, 'America/Chicago');
end;
$$;

revoke all on function public.resolve_account_timezone(uuid) from public;
grant execute on function public.resolve_account_timezone(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- payments.purpose: first-invoice audit row for Study Hall 365 checkout
-- ---------------------------------------------------------------------------
alter table public.payments drop constraint if exists payments_purpose_check;
alter table public.payments
  add constraint payments_purpose_check
  check (purpose in ('booking', 'package', 'subscription'));

-- ---------------------------------------------------------------------------
-- 10 Study Halls — $100 / 600 minutes / never expire
-- Do NOT reuse pkg_10h (historical $190 / 600 minutes).
-- ---------------------------------------------------------------------------
insert into public.package_products (code, name, minutes, price_cents, is_active, sort_order)
values ('pkg_10sh', '10 Study Halls', 600, 10000, true, 0)
on conflict (code) do update
set name = excluded.name,
    minutes = excluded.minutes,
    price_cents = excluded.price_cents,
    is_active = true,
    sort_order = excluded.sort_order,
    updated_at = now();

-- ---------------------------------------------------------------------------
-- Study Hall 365 membership (one Stripe subscription id per row)
-- ---------------------------------------------------------------------------
create table if not exists public.study_hall_365_subscriptions (
  id                      uuid primary key default gen_random_uuid(),
  account_id              uuid not null references public.profiles (id) on delete restrict,
  stripe_customer_id      text not null,
  stripe_subscription_id  text not null,
  stripe_price_id         text,
  stripe_latest_invoice_id text,
  checkout_payment_id     uuid references public.payments (id) on delete set null,
  status                  text not null,
  current_period_start    timestamptz not null,
  current_period_end      timestamptz not null,
  cancel_at_period_end    boolean not null default false,
  canceled_at             timestamptz,
  ended_at                timestamptz,
  last_stripe_event_id    text,
  last_stripe_event_created integer not null default 0,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  constraint study_hall_365_period_ok
    check (current_period_end > current_period_start),
  constraint study_hall_365_status_ok
    check (status in (
      'active', 'trialing', 'past_due', 'unpaid', 'incomplete',
      'incomplete_expired', 'paused', 'canceled', 'ended'
    ))
);

create unique index if not exists study_hall_365_stripe_subscription_key
  on public.study_hall_365_subscriptions (stripe_subscription_id);

-- One open membership per household. Rows drop out when ended_at is set
-- (subscription.deleted / paid period finished) or the checkout expired
-- (incomplete_expired), so the family can subscribe again later.
create unique index if not exists study_hall_365_one_open_membership
  on public.study_hall_365_subscriptions (account_id)
  where ended_at is null
    and status not in ('incomplete_expired', 'ended');

create index if not exists study_hall_365_account_idx
  on public.study_hall_365_subscriptions (account_id, updated_at desc);

drop trigger if exists study_hall_365_subscriptions_touch on public.study_hall_365_subscriptions;
create trigger study_hall_365_subscriptions_touch
  before update on public.study_hall_365_subscriptions
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Daily entitlement consumption — household + local calendar date
-- UNIQUE(account_id, local_date) makes double-consume impossible, including
-- across concurrent requests and later resubscribe on the same civil date.
-- Rows are historical: ordinary booking cancel does NOT delete them.
-- ---------------------------------------------------------------------------
create table if not exists public.study_hall_365_day_usage (
  id              uuid primary key default gen_random_uuid(),
  account_id      uuid not null references public.profiles (id) on delete restrict,
  subscription_id uuid references public.study_hall_365_subscriptions (id) on delete restrict,
  local_date      date not null,
  time_zone       text not null,
  booking_id      uuid references public.bookings (id) on delete set null,
  consumed_at     timestamptz not null default now(),
  unique (account_id, local_date)
);

create index if not exists study_hall_365_day_usage_sub_idx
  on public.study_hall_365_day_usage (subscription_id, local_date);
create index if not exists study_hall_365_day_usage_booking_idx
  on public.study_hall_365_day_usage (booking_id)
  where booking_id is not null;

-- ---------------------------------------------------------------------------
-- RLS — parents read own rows; no client writes; guides have no policy;
-- admins read; service role bypasses.
-- ---------------------------------------------------------------------------
alter table public.study_hall_365_subscriptions enable row level security;
alter table public.study_hall_365_day_usage enable row level security;

drop policy if exists study_hall_365_sub_select_own on public.study_hall_365_subscriptions;
drop policy if exists study_hall_365_sub_select_admin on public.study_hall_365_subscriptions;
drop policy if exists study_hall_365_usage_select_own on public.study_hall_365_day_usage;
drop policy if exists study_hall_365_usage_select_admin on public.study_hall_365_day_usage;

create policy study_hall_365_sub_select_own on public.study_hall_365_subscriptions
  for select to authenticated
  using (account_id = auth.uid());

create policy study_hall_365_sub_select_admin on public.study_hall_365_subscriptions
  for select to authenticated
  using (public.is_admin(auth.uid()));

create policy study_hall_365_usage_select_own on public.study_hall_365_day_usage
  for select to authenticated
  using (account_id = auth.uid());

create policy study_hall_365_usage_select_admin on public.study_hall_365_day_usage
  for select to authenticated
  using (public.is_admin(auth.uid()));

grant select on public.study_hall_365_subscriptions to authenticated;
grant select on public.study_hall_365_day_usage to authenticated;
grant all on public.study_hall_365_subscriptions to service_role;
grant all on public.study_hall_365_day_usage to service_role;

-- ---------------------------------------------------------------------------
-- Entitlement status (single SQL source of truth; mirrored in JS)
-- ---------------------------------------------------------------------------
-- Entitled:
--   * status = active
--   * status = canceled AND cancel_at_period_end AND now < current_period_end
--     AND ended_at is null
-- Not entitled: trialing, past_due, unpaid, incomplete, incomplete_expired,
-- paused, ended, or canceled after the paid window / with ended_at set.
-- ---------------------------------------------------------------------------
create or replace function public.study_hall_365_status_entitled(
  p_status text,
  p_cancel_at_period_end boolean,
  p_period_end timestamptz,
  p_ended_at timestamptz,
  p_now timestamptz default now()
) returns boolean
language sql
immutable
as $$
  select
    p_ended_at is null
    and p_period_end is not null
    and p_now < p_period_end
    and (
      p_status = 'active'
      or (p_status = 'canceled' and coalesce(p_cancel_at_period_end, false) = true)
    );
$$;

revoke all on function public.study_hall_365_status_entitled(text, boolean, timestamptz, timestamptz, timestamptz) from public;
grant execute on function public.study_hall_365_status_entitled(text, boolean, timestamptz, timestamptz, timestamptz)
  to authenticated, service_role;

create or replace function public.study_hall_365_local_date_overlaps_period(
  p_local_date date,
  p_time_zone text,
  p_period_start timestamptz,
  p_period_end timestamptz
) returns boolean
language plpgsql
immutable
as $$
declare
  v_day_start timestamptz;
  v_day_end timestamptz;
  v_tz text := coalesce(nullif(btrim(p_time_zone), ''), 'America/Chicago');
begin
  if p_local_date is null or p_period_start is null or p_period_end is null then
    return false;
  end if;
  begin
    v_day_start := (p_local_date::timestamp AT TIME ZONE v_tz);
    v_day_end := ((p_local_date + 1)::timestamp AT TIME ZONE v_tz);
  exception when others then
    v_day_start := (p_local_date::timestamp AT TIME ZONE 'America/Chicago');
    v_day_end := ((p_local_date + 1)::timestamp AT TIME ZONE 'America/Chicago');
  end;
  return v_day_start < p_period_end and v_day_end > p_period_start;
end;
$$;

revoke all on function public.study_hall_365_local_date_overlaps_period(date, text, timestamptz, timestamptz) from public;
grant execute on function public.study_hall_365_local_date_overlaps_period(date, text, timestamptz, timestamptz)
  to authenticated, service_role;

create or replace function public.study_hall_365_has_open_membership(p_account uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_account is null then
    return false;
  end if;
  if auth.uid() is not null and auth.uid() is distinct from p_account and not public.is_admin(auth.uid()) then
    raise exception 'Not authorized';
  end if;
  return exists (
    select 1
      from public.study_hall_365_subscriptions s
     where s.account_id = p_account
       and s.ended_at is null
       and s.status not in ('incomplete_expired', 'ended')
  );
end;
$$;

revoke all on function public.study_hall_365_has_open_membership(uuid) from public;
grant execute on function public.study_hall_365_has_open_membership(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Start 365 Checkout payment row (no Stripe call here)
-- ---------------------------------------------------------------------------
create or replace function public.start_study_hall_365_checkout(p_account uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_account uuid := coalesce(p_account, auth.uid());
  v_existing record;
  v_payment_id uuid;
  v_hold constant interval := interval '15 minutes';
  v_cents constant integer := 14900;
begin
  if v_account is null then raise exception 'Account is required'; end if;
  if v_caller is not null and v_caller is distinct from v_account and not public.is_admin(v_caller) then
    raise exception 'Not authorized';
  end if;

  if public.study_hall_365_has_open_membership(v_account) then
    raise exception 'This household already has a Study Hall 365 membership';
  end if;

  select id, gross_cents into v_existing
    from public.payments
   where account_id = v_account
     and purpose = 'subscription'
     and status = 'requires_payment'
     and (expires_at is null or expires_at > now())
   order by created_at desc
   limit 1;
  if v_existing.id is not null then
    return jsonb_build_object(
      'payment_id', v_existing.id,
      'gross_cents', v_existing.gross_cents,
      'stripe_cents_due', v_existing.gross_cents,
      'status', 'requires_payment',
      'deduped', true
    );
  end if;

  insert into public.payments (
    account_id, purpose, gross_cents, stripe_paid_cents, credit_applied_cents,
    status, expires_at
  ) values (
    v_account, 'subscription', v_cents, 0, 0, 'requires_payment', now() + v_hold
  ) returning id into v_payment_id;

  return jsonb_build_object(
    'payment_id', v_payment_id,
    'gross_cents', v_cents,
    'stripe_cents_due', v_cents,
    'status', 'requires_payment',
    'deduped', false
  );
end;
$$;

revoke all on function public.start_study_hall_365_checkout(uuid) from public;
grant execute on function public.start_study_hall_365_checkout(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Mark the first-invoice 365 payment succeeded (never credits minutes)
-- ---------------------------------------------------------------------------
create or replace function public.fulfill_study_hall_365_payment(
  p_payment_id uuid,
  p_amount_cents integer default null,
  p_charge_id text default null,
  p_subscription_id text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pay record;
begin
  if not public.is_financial_actor() then raise exception 'Not authorized'; end if;

  select * into v_pay from public.payments where id = p_payment_id for update;
  if v_pay.id is null then
    return jsonb_build_object('status', 'missing');
  end if;
  if v_pay.purpose is distinct from 'subscription' then
    return jsonb_build_object('status', 'ignored', 'reason', 'not_subscription');
  end if;
  if v_pay.status = 'succeeded' then
    return jsonb_build_object('status', 'already_fulfilled', 'payment_id', v_pay.id);
  end if;
  if v_pay.status not in ('requires_payment', 'processing', 'created') then
    return jsonb_build_object('status', 'ignored', 'reason', v_pay.status);
  end if;

  update public.payments
     set status = 'succeeded',
         fulfilled_at = coalesce(fulfilled_at, now()),
         stripe_paid_cents = coalesce(p_amount_cents, stripe_paid_cents, gross_cents),
         stripe_charge_id = coalesce(p_charge_id, stripe_charge_id),
         stripe_payment_intent_id = coalesce(p_charge_id, stripe_payment_intent_id),
         expires_at = null
   where id = p_payment_id;

  return jsonb_build_object(
    'status', 'fulfilled',
    'payment_id', p_payment_id,
    'account_id', v_pay.account_id,
    'subscription_id', p_subscription_id
  );
end;
$$;

revoke all on function public.fulfill_study_hall_365_payment(uuid, integer, text, text) from public;
grant execute on function public.fulfill_study_hall_365_payment(uuid, integer, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- Upsert membership from a verified Stripe snapshot (out-of-order safe)
-- ---------------------------------------------------------------------------
create or replace function public.upsert_study_hall_365_subscription(
  p_account uuid,
  p_stripe_customer_id text,
  p_stripe_subscription_id text,
  p_stripe_price_id text,
  p_status text,
  p_period_start timestamptz,
  p_period_end timestamptz,
  p_cancel_at_period_end boolean,
  p_canceled_at timestamptz,
  p_ended_at timestamptz,
  p_latest_invoice_id text,
  p_event_id text,
  p_event_created integer,
  p_payment_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.study_hall_365_subscriptions;
  v_status text;
  v_ended timestamptz;
begin
  if not public.is_financial_actor() then raise exception 'Not authorized'; end if;
  if p_account is null or p_stripe_subscription_id is null or p_stripe_customer_id is null then
    raise exception 'subscription identity is required';
  end if;
  if p_period_start is null or p_period_end is null or p_period_end <= p_period_start then
    raise exception 'valid billing period is required';
  end if;

  v_status := p_status;
  if v_status is null or v_status not in (
    'active', 'trialing', 'past_due', 'unpaid', 'incomplete',
    'incomplete_expired', 'paused', 'canceled', 'ended'
  ) then
    raise exception 'unsupported subscription status';
  end if;

  v_ended := p_ended_at;
  if v_status in ('incomplete_expired', 'ended') then
    v_ended := coalesce(v_ended, now());
  end if;

  select * into v_row
    from public.study_hall_365_subscriptions
   where stripe_subscription_id = p_stripe_subscription_id
   for update;

  if v_row.id is not null then
    if coalesce(p_event_created, 0) < coalesce(v_row.last_stripe_event_created, 0) then
      insert into public.financial_audit_log (actor_id, action, entity_type, entity_id, previous_state, new_state, reason)
      values (
        null, 'study_hall_365_stale_event', 'study_hall_365_subscriptions', v_row.id,
        jsonb_build_object('last_stripe_event_created', v_row.last_stripe_event_created, 'last_stripe_event_id', v_row.last_stripe_event_id),
        jsonb_build_object('ignored_event_created', p_event_created, 'ignored_event_id', p_event_id),
        'stale Stripe event ignored'
      );
      return jsonb_build_object('status', 'skipped_stale', 'id', v_row.id);
    end if;

    update public.study_hall_365_subscriptions
       set stripe_customer_id = p_stripe_customer_id,
           stripe_price_id = coalesce(p_stripe_price_id, stripe_price_id),
           stripe_latest_invoice_id = coalesce(p_latest_invoice_id, stripe_latest_invoice_id),
           checkout_payment_id = coalesce(p_payment_id, checkout_payment_id),
           status = v_status,
           current_period_start = p_period_start,
           current_period_end = p_period_end,
           cancel_at_period_end = coalesce(p_cancel_at_period_end, false),
           canceled_at = p_canceled_at,
           ended_at = v_ended,
           last_stripe_event_id = coalesce(p_event_id, last_stripe_event_id),
           last_stripe_event_created = coalesce(p_event_created, last_stripe_event_created)
     where id = v_row.id;

    return jsonb_build_object('status', 'updated', 'id', v_row.id, 'account_id', v_row.account_id);
  end if;

  insert into public.study_hall_365_subscriptions (
    account_id, stripe_customer_id, stripe_subscription_id, stripe_price_id,
    stripe_latest_invoice_id, checkout_payment_id, status,
    current_period_start, current_period_end, cancel_at_period_end,
    canceled_at, ended_at, last_stripe_event_id, last_stripe_event_created
  ) values (
    p_account, p_stripe_customer_id, p_stripe_subscription_id, p_stripe_price_id,
    p_latest_invoice_id, p_payment_id, v_status,
    p_period_start, p_period_end, coalesce(p_cancel_at_period_end, false),
    p_canceled_at, v_ended, p_event_id, coalesce(p_event_created, 0)
  )
  returning * into v_row;

  return jsonb_build_object('status', 'inserted', 'id', v_row.id, 'account_id', v_row.account_id);
exception
  when unique_violation then
    raise exception 'This household already has a Study Hall 365 membership';
end;
$$;

revoke all on function public.upsert_study_hall_365_subscription(
  uuid, text, text, text, text, timestamptz, timestamptz, boolean, timestamptz, timestamptz, text, text, integer, uuid
) from public;
grant execute on function public.upsert_study_hall_365_subscription(
  uuid, text, text, text, text, timestamptz, timestamptz, boolean, timestamptz, timestamptz, text, text, integer, uuid
) to service_role;

-- ---------------------------------------------------------------------------
-- Consume one household local day (atomic + unique)
-- ---------------------------------------------------------------------------
create or replace function public.consume_study_hall_365_day(
  p_account uuid,
  p_local_date date,
  p_booking_id uuid default null,
  p_as_of timestamptz default now()
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub public.study_hall_365_subscriptions;
  v_tz text;
  v_id uuid;
  v_now timestamptz := coalesce(p_as_of, now());
begin
  if not public.is_financial_actor() then raise exception 'Not authorized'; end if;
  if p_account is null or p_local_date is null then
    raise exception 'account and local date are required';
  end if;

  v_tz := public.resolve_account_timezone(p_account);

  select * into v_sub
    from public.study_hall_365_subscriptions
   where account_id = p_account
     and ended_at is null
     and public.study_hall_365_status_entitled(
       status, cancel_at_period_end, current_period_end, ended_at, v_now
     )
     and public.study_hall_365_local_date_overlaps_period(
       p_local_date, v_tz, current_period_start, current_period_end
     )
   order by current_period_end desc
   limit 1
   for update;

  if v_sub.id is null then
    return jsonb_build_object(
      'ok', false,
      'reason', 'not_entitled',
      'local_date', p_local_date,
      'time_zone', v_tz
    );
  end if;

  insert into public.study_hall_365_day_usage (
    account_id, subscription_id, local_date, time_zone, booking_id
  ) values (
    p_account, v_sub.id, p_local_date, v_tz, p_booking_id
  )
  on conflict (account_id, local_date) do nothing
  returning id into v_id;

  if v_id is null then
    return jsonb_build_object(
      'ok', false,
      'reason', 'already_consumed',
      'local_date', p_local_date,
      'time_zone', v_tz,
      'subscription_id', v_sub.id
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'reason', 'consumed',
    'id', v_id,
    'local_date', p_local_date,
    'time_zone', v_tz,
    'subscription_id', v_sub.id,
    'booking_id', p_booking_id,
    'source', 'study_hall_365'
  );
end;
$$;

revoke all on function public.consume_study_hall_365_day(uuid, date, uuid, timestamptz) from public;
grant execute on function public.consume_study_hall_365_day(uuid, date, uuid, timestamptz) to service_role;

-- ---------------------------------------------------------------------------
-- Read model for future booking (PR3). Authenticated callers: own account only.
-- ---------------------------------------------------------------------------
create or replace function public.get_study_hall_365_entitlement(
  p_account uuid,
  p_local_date date default null,
  p_as_of timestamptz default now()
) returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_account uuid := coalesce(p_account, auth.uid());
  v_now timestamptz := coalesce(p_as_of, now());
  v_tz text;
  v_date date;
  v_sub public.study_hall_365_subscriptions;
  v_used public.study_hall_365_day_usage;
  v_status_ok boolean := false;
  v_day_ok boolean := false;
  v_entitled boolean := false;
  v_reason text;
begin
  if v_account is null then raise exception 'Account is required'; end if;
  if auth.uid() is not null and auth.uid() is distinct from v_account and not public.is_admin(auth.uid()) then
    raise exception 'Not authorized';
  end if;

  v_tz := public.resolve_account_timezone(v_account);
  if p_local_date is not null then
    v_date := p_local_date;
  else
    begin
      v_date := (v_now AT TIME ZONE v_tz)::date;
    exception when others then
      v_date := (v_now AT TIME ZONE 'America/Chicago')::date;
    end;
  end if;

  select * into v_sub
    from public.study_hall_365_subscriptions
   where account_id = v_account
   order by created_at desc
   limit 1;

  if v_sub.id is not null then
    v_status_ok := public.study_hall_365_status_entitled(
      v_sub.status, v_sub.cancel_at_period_end, v_sub.current_period_end, v_sub.ended_at, v_now
    );
    v_day_ok := public.study_hall_365_local_date_overlaps_period(
      v_date, v_tz, v_sub.current_period_start, v_sub.current_period_end
    );
    select * into v_used
      from public.study_hall_365_day_usage
     where account_id = v_account and local_date = v_date;
  end if;

  if v_sub.id is null then
    v_reason := 'no_membership';
  elsif not v_status_ok then
    v_reason := 'status_not_entitled';
  elsif not v_day_ok then
    v_reason := 'outside_paid_period';
  elsif v_used.id is not null then
    v_reason := 'already_consumed';
  else
    v_entitled := true;
    v_reason := 'available';
  end if;

  return jsonb_build_object(
    'entitled', v_entitled,
    'source', case when v_entitled then 'study_hall_365' else 'none' end,
    'reason', v_reason,
    'local_date', v_date,
    'time_zone', v_tz,
    'subscription_id', v_sub.id,
    'status', v_sub.status,
    'cancel_at_period_end', v_sub.cancel_at_period_end,
    'current_period_start', v_sub.current_period_start,
    'current_period_end', v_sub.current_period_end,
    'ended_at', v_sub.ended_at,
    'consumed', v_used.id is not null,
    'consumed_booking_id', v_used.booking_id
  );
end;
$$;

revoke all on function public.get_study_hall_365_entitlement(uuid, date, timestamptz) from public;
grant execute on function public.get_study_hall_365_entitlement(uuid, date, timestamptz)
  to authenticated, service_role;

notify pgrst, 'reload schema';
