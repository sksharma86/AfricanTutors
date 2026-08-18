-- =============================================================================
-- African Tutors — Phase 4A: Stripe & financial foundation
-- =============================================================================
-- Additive on top of Phase 2/3. Adds the auditable financial ledger foundation:
--   * package_products (seeded), payments, package_minute_ledger,
--     dollar_credit_ledger, tutor_earnings, stripe_events, financial_audit_log
--   * tutor compensation rate (admin-only) + profiles.stripe_customer_id
--   * atomic, idempotent SECURITY DEFINER money functions + balance derivation
--
-- All money is INTEGER CENTS. Ledgers are the source of truth; balances are
-- derived. Customers/tutors can never mutate ledgers or set prices/rates.
-- Does not change Phase 3 booking state model. Idempotent.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Additive columns on existing tables
-- ---------------------------------------------------------------------------
-- Stripe customer id lives on the account (a profiles row).
alter table public.profiles add column if not exists stripe_customer_id text;
create unique index if not exists profiles_stripe_customer_id_key
  on public.profiles (stripe_customer_id) where stripe_customer_id is not null;

-- Admin-configurable tutor hourly compensation (cents). NULL = not yet set.
alter table public.tutor_profiles add column if not exists comp_rate_cents_per_hour integer;
alter table public.tutor_profiles drop constraint if exists tutor_comp_rate_nonneg;
alter table public.tutor_profiles add constraint tutor_comp_rate_nonneg
  check (comp_rate_cents_per_hour is null or comp_rate_cents_per_hour >= 0);

-- ---------------------------------------------------------------------------
-- package_products — admin-managed catalog of purchasable minute bundles.
-- ---------------------------------------------------------------------------
create table if not exists public.package_products (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  name        text not null,
  minutes     integer not null check (minutes > 0),
  price_cents integer not null check (price_cents >= 0),
  is_active   boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- payments — authoritative record of money moving via Stripe and/or credit.
-- ---------------------------------------------------------------------------
create table if not exists public.payments (
  id                        uuid primary key default gen_random_uuid(),
  account_id                uuid not null references public.profiles (id) on delete cascade,
  purpose                   text not null check (purpose in ('booking','package')),
  booking_id                uuid references public.bookings (id) on delete set null,
  package_product_id        uuid references public.package_products (id) on delete set null,
  gross_cents               integer not null check (gross_cents >= 0),
  stripe_paid_cents         integer not null default 0 check (stripe_paid_cents >= 0),
  credit_applied_cents      integer not null default 0 check (credit_applied_cents >= 0),
  refunded_cents            integer not null default 0 check (refunded_cents >= 0),
  currency                  text not null default 'usd',
  status                    text not null default 'created'
                              check (status in ('created','requires_payment','processing','succeeded','failed','canceled','refunded','partially_refunded')),
  stripe_customer_id        text,
  stripe_payment_intent_id  text unique,
  stripe_checkout_session_id text unique,
  stripe_charge_id          text,
  idempotency_key           text unique,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);
create index if not exists payments_account_idx on public.payments (account_id);
create index if not exists payments_booking_idx on public.payments (booking_id);

-- ---------------------------------------------------------------------------
-- package_minute_ledger — auditable minute movements. Balance = sum(delta).
-- ---------------------------------------------------------------------------
create table if not exists public.package_minute_ledger (
  id                 uuid primary key default gen_random_uuid(),
  account_id         uuid not null references public.profiles (id) on delete cascade,
  minutes_delta      integer not null,  -- + issuance/restoration, - consumption
  entry_type         text not null check (entry_type in ('purchase','consumption','restoration','admin_adjustment')),
  payment_id         uuid references public.payments (id) on delete set null,
  booking_id         uuid references public.bookings (id) on delete set null,
  package_product_id uuid references public.package_products (id) on delete set null,
  reason             text,
  reference          text unique,  -- idempotency key for the movement
  created_by         uuid references public.profiles (id),
  created_at         timestamptz not null default now()
);
create index if not exists pkg_minute_ledger_account_idx on public.package_minute_ledger (account_id);

-- ---------------------------------------------------------------------------
-- dollar_credit_ledger — auditable dollar-credit movements (cents, signed).
-- ---------------------------------------------------------------------------
create table if not exists public.dollar_credit_ledger (
  id           uuid primary key default gen_random_uuid(),
  account_id   uuid not null references public.profiles (id) on delete cascade,
  amount_cents integer not null,  -- + issuance/restoration/refund, - consumption
  entry_type   text not null check (entry_type in ('issuance','consumption','restoration','refund','admin_adjustment','promotion','referral')),
  payment_id   uuid references public.payments (id) on delete set null,
  booking_id   uuid references public.bookings (id) on delete set null,
  reason       text,
  reference    text unique,  -- idempotency key
  created_by   uuid references public.profiles (id),
  created_at   timestamptz not null default now()
);
create index if not exists dollar_credit_ledger_account_idx on public.dollar_credit_ledger (account_id);

-- ---------------------------------------------------------------------------
-- tutor_earnings — one record per booking; rate snapshotted at earning time.
-- ---------------------------------------------------------------------------
create table if not exists public.tutor_earnings (
  id                  uuid primary key default gen_random_uuid(),
  tutor_id            uuid not null references public.profiles (id) on delete cascade,
  booking_id          uuid unique references public.bookings (id) on delete set null,
  duration_minutes    integer not null,
  rate_cents_per_hour integer not null,             -- snapshot; never rewritten by future rate changes
  amount_cents        integer not null check (amount_cents >= 0),
  status              text not null default 'pending'
                        check (status in ('pending','earned','paid','voided','adjusted')),
  earned_at           timestamptz,
  paid_at             timestamptz,
  adjusted_from_cents integer,
  reason              text,
  created_by          uuid references public.profiles (id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists tutor_earnings_tutor_idx on public.tutor_earnings (tutor_id, status);

-- ---------------------------------------------------------------------------
-- stripe_events — processed-event log for webhook idempotency.
-- ---------------------------------------------------------------------------
create table if not exists public.stripe_events (
  id           text primary key,  -- Stripe event id (evt_...)
  type         text,
  processed_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- financial_audit_log — traceability for financial/admin mutations.
-- ---------------------------------------------------------------------------
create table if not exists public.financial_audit_log (
  id             uuid primary key default gen_random_uuid(),
  actor_id       uuid references public.profiles (id),
  action         text not null,
  entity_type    text,
  entity_id      uuid,
  previous_state jsonb,
  new_state      jsonb,
  reason         text,
  created_at     timestamptz not null default now()
);

-- Creator/actor references should not block deleting a user; preserve the
-- audit/ledger history with the reference set to NULL instead.
alter table public.package_minute_ledger drop constraint if exists package_minute_ledger_created_by_fkey;
alter table public.package_minute_ledger add constraint package_minute_ledger_created_by_fkey
  foreign key (created_by) references public.profiles (id) on delete set null;
alter table public.dollar_credit_ledger drop constraint if exists dollar_credit_ledger_created_by_fkey;
alter table public.dollar_credit_ledger add constraint dollar_credit_ledger_created_by_fkey
  foreign key (created_by) references public.profiles (id) on delete set null;
alter table public.tutor_earnings drop constraint if exists tutor_earnings_created_by_fkey;
alter table public.tutor_earnings add constraint tutor_earnings_created_by_fkey
  foreign key (created_by) references public.profiles (id) on delete set null;
alter table public.financial_audit_log drop constraint if exists financial_audit_log_actor_id_fkey;
alter table public.financial_audit_log add constraint financial_audit_log_actor_id_fkey
  foreign key (actor_id) references public.profiles (id) on delete set null;

-- updated_at maintenance (reuse Phase 3 touch_updated_at)
drop trigger if exists package_products_touch on public.package_products;
create trigger package_products_touch before update on public.package_products
  for each row execute function public.touch_updated_at();
drop trigger if exists payments_touch on public.payments;
create trigger payments_touch before update on public.payments
  for each row execute function public.touch_updated_at();
drop trigger if exists tutor_earnings_touch on public.tutor_earnings;
create trigger tutor_earnings_touch before update on public.tutor_earnings
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Guard: only admins (or service-role/system context where auth.uid() is null)
-- may change a tutor's compensation rate or approval state.
-- ---------------------------------------------------------------------------
create or replace function public.guard_tutor_privileges()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (new.status is distinct from old.status
      or new.approved_by is distinct from old.approved_by
      or new.approved_at is distinct from old.approved_at
      or new.comp_rate_cents_per_hour is distinct from old.comp_rate_cents_per_hour)
     and auth.uid() is not null
     and not public.is_admin(auth.uid()) then
    raise exception 'Not authorized to change tutor approval or compensation state';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Helper: is the current context an authorized financial actor?
-- (admin user, or service-role/system where auth.uid() is null)
-- ---------------------------------------------------------------------------
create or replace function public.is_financial_actor()
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is null or public.is_admin(auth.uid());
$$;

-- ---------------------------------------------------------------------------
-- Balance derivation (authorized: owner or admin)
-- ---------------------------------------------------------------------------
create or replace function public.get_package_minutes(p_account uuid)
returns integer language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is not null and auth.uid() <> p_account and not public.is_admin(auth.uid()) then
    raise exception 'Not authorized';
  end if;
  return coalesce((select sum(minutes_delta) from public.package_minute_ledger where account_id = p_account), 0);
end;
$$;

create or replace function public.get_dollar_credit(p_account uuid)
returns integer language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is not null and auth.uid() <> p_account and not public.is_admin(auth.uid()) then
    raise exception 'Not authorized';
  end if;
  return coalesce((select sum(amount_cents) from public.dollar_credit_ledger where account_id = p_account), 0);
end;
$$;

-- ---------------------------------------------------------------------------
-- Atomic, idempotent money operations (admin/service only)
-- ---------------------------------------------------------------------------
create or replace function public.issue_package_minutes(
  p_account uuid, p_minutes integer, p_reference text,
  p_payment_id uuid default null, p_package_product_id uuid default null, p_reason text default null
) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_financial_actor() then raise exception 'Not authorized'; end if;
  if p_minutes <= 0 then raise exception 'minutes must be positive'; end if;
  insert into public.package_minute_ledger (account_id, minutes_delta, entry_type, payment_id, package_product_id, reason, reference, created_by)
  values (p_account, p_minutes, 'purchase', p_payment_id, p_package_product_id, p_reason, p_reference, auth.uid())
  on conflict (reference) do nothing;
  return found;  -- true if newly inserted, false if duplicate reference (idempotent)
end;
$$;

create or replace function public.consume_package_minutes(
  p_account uuid, p_minutes integer, p_booking_id uuid, p_reference text, p_reason text default null
) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_bal integer;
begin
  if not public.is_financial_actor() then raise exception 'Not authorized'; end if;
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

-- Record a tutor earning for a booking. Rate is snapshotted; 30-min = 50% of
-- the hourly rate (general prorate = rate * minutes / 60). One per booking.
create or replace function public.record_tutor_earning(
  p_tutor uuid, p_booking uuid, p_duration integer, p_reason text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_rate integer; v_amount integer; v_id uuid;
begin
  if not public.is_financial_actor() then raise exception 'Not authorized'; end if;
  select comp_rate_cents_per_hour into v_rate from public.tutor_profiles where profile_id = p_tutor;
  if v_rate is null then raise exception 'Tutor compensation rate is not set'; end if;
  v_amount := round(v_rate::numeric * p_duration / 60.0)::integer;
  insert into public.tutor_earnings (tutor_id, booking_id, duration_minutes, rate_cents_per_hour, amount_cents, status, earned_at, reason, created_by)
  values (p_tutor, p_booking, p_duration, v_rate, v_amount, 'earned', now(), p_reason, auth.uid())
  on conflict (booking_id) do nothing
  returning id into v_id;
  return v_id;  -- null if an earning already existed for this booking (idempotent)
end;
$$;

-- Admin sets a tutor's compensation rate (with audit).
create or replace function public.admin_set_tutor_rate(p_tutor uuid, p_rate_cents integer)
returns void language plpgsql security definer set search_path = public as $$
declare v_old integer;
begin
  if not public.is_admin(auth.uid()) then raise exception 'Not authorized'; end if;
  if p_rate_cents < 0 then raise exception 'rate must be non-negative'; end if;
  select comp_rate_cents_per_hour into v_old from public.tutor_profiles where profile_id = p_tutor;
  update public.tutor_profiles set comp_rate_cents_per_hour = p_rate_cents where profile_id = p_tutor;
  insert into public.financial_audit_log (actor_id, action, entity_type, entity_id, previous_state, new_state, reason)
  values (auth.uid(), 'set_tutor_rate', 'tutor_profiles', p_tutor,
          jsonb_build_object('comp_rate_cents_per_hour', v_old),
          jsonb_build_object('comp_rate_cents_per_hour', p_rate_cents), 'admin rate update');
end;
$$;

-- Webhook idempotency: returns true if this event is new (and records it),
-- false if it was already processed.
create or replace function public.mark_stripe_event_processed(p_event_id text, p_type text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not public.is_financial_actor() then raise exception 'Not authorized'; end if;
  insert into public.stripe_events (id, type) values (p_event_id, p_type)
  on conflict (id) do nothing;
  return found;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.package_products    enable row level security;
alter table public.payments            enable row level security;
alter table public.package_minute_ledger enable row level security;
alter table public.dollar_credit_ledger  enable row level security;
alter table public.tutor_earnings      enable row level security;
alter table public.stripe_events       enable row level security;
alter table public.financial_audit_log enable row level security;

-- package_products: public read of active; admin write.
drop policy if exists package_products_select on public.package_products;
drop policy if exists package_products_admin on public.package_products;
create policy package_products_select on public.package_products for select to anon, authenticated
  using (is_active or public.is_admin(auth.uid()));
create policy package_products_admin on public.package_products for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- payments / ledgers / earnings: owner (or tutor for earnings) + admin read only.
drop policy if exists payments_select on public.payments;
create policy payments_select on public.payments for select to authenticated
  using (account_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists pkg_ledger_select on public.package_minute_ledger;
create policy pkg_ledger_select on public.package_minute_ledger for select to authenticated
  using (account_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists dollar_ledger_select on public.dollar_credit_ledger;
create policy dollar_ledger_select on public.dollar_credit_ledger for select to authenticated
  using (account_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists tutor_earnings_select on public.tutor_earnings;
create policy tutor_earnings_select on public.tutor_earnings for select to authenticated
  using (tutor_id = auth.uid() or public.is_admin(auth.uid()));

-- stripe_events + audit: admin read only; writes via SECURITY DEFINER/service.
drop policy if exists stripe_events_admin on public.stripe_events;
create policy stripe_events_admin on public.stripe_events for select to authenticated
  using (public.is_admin(auth.uid()));
drop policy if exists financial_audit_admin on public.financial_audit_log;
create policy financial_audit_admin on public.financial_audit_log for select to authenticated
  using (public.is_admin(auth.uid()));

-- No INSERT/UPDATE/DELETE policies for authenticated on ledgers/payments/
-- earnings/stripe_events/audit → all client writes denied (SECURITY DEFINER
-- functions and the service role are the only writers).

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
grant select on public.package_products to anon, authenticated;
grant all on public.package_products to authenticated;   -- constrained to admins by RLS
grant select on public.payments, public.package_minute_ledger, public.dollar_credit_ledger,
                public.tutor_earnings, public.stripe_events, public.financial_audit_log to authenticated;
grant all on public.package_products, public.payments, public.package_minute_ledger,
             public.dollar_credit_ledger, public.tutor_earnings, public.stripe_events,
             public.financial_audit_log to service_role;

do $$
declare fn text;
begin
  for fn in select unnest(array[
    'get_package_minutes(uuid)','get_dollar_credit(uuid)',
    'issue_package_minutes(uuid,integer,text,uuid,uuid,text)',
    'consume_package_minutes(uuid,integer,uuid,text,text)',
    'restore_package_minutes(uuid,integer,uuid,text,text)',
    'issue_dollar_credit(uuid,integer,text,text,text,uuid,uuid)',
    'consume_dollar_credit(uuid,integer,text,text,uuid,uuid)',
    'record_tutor_earning(uuid,uuid,integer,text)',
    'admin_set_tutor_rate(uuid,integer)',
    'mark_stripe_event_processed(text,text)',
    'is_financial_actor()'
  ]) loop
    execute format('revoke all on function public.%s from public', fn);
    execute format('grant execute on function public.%s to authenticated, service_role', fn);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Seed package products (idempotent). Integer cents.
-- ---------------------------------------------------------------------------
insert into public.package_products (code, name, minutes, price_cents, sort_order) values
  ('pkg_10h', '10 Hours', 600, 19000, 1),
  ('pkg_20h', '20 Hours', 1200, 36000, 2),
  ('pkg_40h', '40 Hours', 2400, 68000, 3)
on conflict (code) do nothing;

notify pgrst, 'reload schema';
