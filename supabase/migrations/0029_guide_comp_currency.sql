-- =============================================================================
-- Study Hall (at home) — Guide compensation multi-currency
-- =============================================================================
-- Customer Stripe revenue stays USD. Guide compensation is a separate
-- external-payout ledger and may be KES / USD / INR / PHP / NGN.
--
-- Existing rates/earnings were stored as integer minor units and displayed
-- with formatCents ($) — they are labeled USD. Amounts are NOT converted.
-- Historical rows keep their original numbers; new earnings snapshot both
-- amount and currency from the Guide's configured rate.
-- =============================================================================

create table if not exists public.compensation_currencies (
  code text primary key check (code ~ '^[A-Z]{3}$'),
  active boolean not null default true
);

insert into public.compensation_currencies (code, active) values
  ('KES', true),
  ('USD', true),
  ('INR', true),
  ('PHP', true),
  ('NGN', true)
on conflict (code) do nothing;

alter table public.tutor_profiles
  add column if not exists comp_currency text;

update public.tutor_profiles
   set comp_currency = 'USD'
 where comp_currency is null;

alter table public.tutor_profiles
  alter column comp_currency set default 'USD';

alter table public.tutor_profiles
  alter column comp_currency set not null;

alter table public.tutor_profiles drop constraint if exists tutor_profiles_comp_currency_fkey;
alter table public.tutor_profiles
  add constraint tutor_profiles_comp_currency_fkey
  foreign key (comp_currency) references public.compensation_currencies (code);

alter table public.tutor_earnings
  add column if not exists currency text;

update public.tutor_earnings
   set currency = 'USD'
 where currency is null;

alter table public.tutor_earnings
  alter column currency set default 'USD';

alter table public.tutor_earnings
  alter column currency set not null;

alter table public.tutor_earnings drop constraint if exists tutor_earnings_currency_fkey;
alter table public.tutor_earnings
  add constraint tutor_earnings_currency_fkey
  foreign key (currency) references public.compensation_currencies (code);

comment on column public.tutor_profiles.comp_currency is
  'ISO 4217 currency for this Guide''s compensation rate. Manager-set; not inferred.';
comment on column public.tutor_earnings.currency is
  'ISO 4217 currency snapshotted when the earning was created. Never rewritten by later rate/currency changes.';

revoke all on public.compensation_currencies from public;
grant select on public.compensation_currencies to authenticated, service_role;

alter table public.compensation_currencies enable row level security;
drop policy if exists compensation_currencies_select on public.compensation_currencies;
create policy compensation_currencies_select on public.compensation_currencies
  for select to anon, authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- admin_set_tutor_rate — amount + currency (default USD keeps existing callers)
-- ---------------------------------------------------------------------------
drop function if exists public.admin_set_tutor_rate(uuid, integer);

create or replace function public.admin_set_tutor_rate(p_tutor uuid, p_rate_cents integer, p_currency text default 'USD')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_rate integer;
  v_old_ccy text;
  v_ccy text := upper(btrim(coalesce(p_currency, 'USD')));
begin
  if not public.is_admin(auth.uid()) then raise exception 'Not authorized'; end if;
  if p_rate_cents < 0 then raise exception 'rate must be non-negative'; end if;
  if not exists (select 1 from public.compensation_currencies where code = v_ccy and active) then
    raise exception 'Unsupported compensation currency';
  end if;

  select comp_rate_cents_per_hour, comp_currency
    into v_old_rate, v_old_ccy
    from public.tutor_profiles
   where profile_id = p_tutor;

  update public.tutor_profiles
     set comp_rate_cents_per_hour = p_rate_cents,
         comp_currency = v_ccy
   where profile_id = p_tutor;

  insert into public.financial_audit_log (actor_id, action, entity_type, entity_id, previous_state, new_state, reason)
  values (
    auth.uid(),
    'set_tutor_rate',
    'tutor_profiles',
    p_tutor,
    jsonb_build_object('comp_rate_cents_per_hour', v_old_rate, 'comp_currency', v_old_ccy),
    jsonb_build_object('comp_rate_cents_per_hour', p_rate_cents, 'comp_currency', v_ccy),
    'admin rate update'
  );
end;
$$;

revoke all on function public.admin_set_tutor_rate(uuid, integer, text) from public;
grant execute on function public.admin_set_tutor_rate(uuid, integer, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Snapshot currency with the amount on earning creation.
-- ---------------------------------------------------------------------------
create or replace function public.record_full_earning(p_booking uuid, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tutor uuid;
  v_duration int;
  v_rate int;
  v_ccy text;
  v_amount int;
  v_id uuid;
begin
  select tutor_id, duration_minutes into v_tutor, v_duration from public.bookings where id = p_booking;
  if v_tutor is null then raise exception 'Booking has no assigned tutor'; end if;
  if v_duration is null or v_duration <= 0 then raise exception 'Booking has no valid duration'; end if;
  select comp_rate_cents_per_hour, coalesce(comp_currency, 'USD')
    into v_rate, v_ccy
    from public.tutor_profiles
   where profile_id = v_tutor;
  if v_rate is null then raise exception 'Tutor compensation rate is not set'; end if;
  v_amount := round(v_rate::numeric * v_duration / 60.0)::integer;
  insert into public.tutor_earnings (
    tutor_id, booking_id, duration_minutes, rate_cents_per_hour, amount_cents, currency, status, earned_at, reason, created_by
  )
  values (v_tutor, p_booking, v_duration, v_rate, v_amount, v_ccy, 'earned', now(), p_reason, auth.uid())
  on conflict (booking_id) do nothing
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.record_tutor_earning(p_booking uuid, p_reason text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tutor uuid;
  v_duration integer;
  v_rate integer;
  v_ccy text;
  v_amount integer;
  v_id uuid;
begin
  if not public.is_financial_actor() then raise exception 'Not authorized'; end if;
  select tutor_id, duration_minutes into v_tutor, v_duration
    from public.bookings where id = p_booking;
  if not found then raise exception 'Booking not found'; end if;
  if v_tutor is null then raise exception 'Booking has no assigned tutor'; end if;
  if v_duration is null or v_duration <= 0 then raise exception 'Booking has no valid duration'; end if;
  select comp_rate_cents_per_hour, coalesce(comp_currency, 'USD')
    into v_rate, v_ccy
    from public.tutor_profiles
   where profile_id = v_tutor;
  if v_rate is null then raise exception 'Tutor compensation rate is not set'; end if;
  v_amount := round(v_rate::numeric * v_duration / 60.0)::integer;
  insert into public.tutor_earnings (
    tutor_id, booking_id, duration_minutes, rate_cents_per_hour, amount_cents, currency, status, earned_at, reason, created_by
  )
  values (v_tutor, p_booking, v_duration, v_rate, v_amount, v_ccy, 'earned', now(), p_reason, auth.uid())
  on conflict (booking_id) do nothing
  returning id into v_id;
  return v_id;
end;
$$;

notify pgrst, 'reload schema';
