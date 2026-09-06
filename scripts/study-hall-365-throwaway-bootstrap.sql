-- Throwaway local Postgres stubs so 0036/0037 can be applied without Supabase.
-- Never point this at the shared demo or production.

create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end $$;

create schema if not exists auth;

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type public.user_role as enum ('student', 'tutor', 'admin');
  end if;
end $$;

create table if not exists public.profiles (
  id uuid primary key,
  role public.user_role not null default 'student',
  display_name text,
  stripe_customer_id text,
  timezone text,
  created_at timestamptz not null default now()
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.profiles (id),
  timezone text default 'America/Chicago',
  created_at timestamptz not null default now()
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.profiles (id),
  status text not null default 'confirmed',
  created_at timestamptz not null default now()
);

create table if not exists public.package_products (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  minutes integer not null,
  price_cents integer not null,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.profiles (id),
  purpose text not null check (purpose in ('booking','package')),
  booking_id uuid references public.bookings (id),
  package_product_id uuid references public.package_products (id),
  gross_cents integer not null default 0,
  stripe_paid_cents integer not null default 0,
  credit_applied_cents integer not null default 0,
  refunded_cents integer not null default 0,
  currency text not null default 'usd',
  status text not null default 'created',
  stripe_customer_id text,
  stripe_payment_intent_id text,
  stripe_checkout_session_id text,
  stripe_charge_id text,
  idempotency_key text,
  note text,
  fulfilled_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.package_minute_ledger (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.profiles (id),
  minutes_delta integer not null,
  entry_type text not null,
  payment_id uuid references public.payments (id),
  booking_id uuid references public.bookings (id),
  package_product_id uuid references public.package_products (id),
  reason text,
  reference text not null unique,
  created_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.dollar_credit_ledger (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.profiles (id),
  amount_cents integer not null,
  entry_type text not null,
  payment_id uuid references public.payments (id),
  booking_id uuid references public.bookings (id),
  reason text,
  reference text not null unique,
  created_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.financial_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  action text not null,
  entity_type text,
  entity_id uuid,
  previous_state jsonb,
  new_state jsonb,
  reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.stripe_events (
  id text primary key,
  type text,
  status text not null default 'processing',
  attempts integer not null default 0,
  last_error text,
  processed_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.is_admin(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = uid and p.role = 'admin');
$$;

create or replace function public.is_financial_actor()
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is null or public.is_admin(auth.uid());
$$;

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

create or replace function public.fulfill_package_payment(
  p_payment_id uuid, p_amount_cents integer default null, p_charge_id text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_pay record; v_minutes int; v_expected int; v_paid int;
begin
  if not public.is_financial_actor() then raise exception 'Not authorized'; end if;
  select * into v_pay from public.payments where id = p_payment_id for update;
  if v_pay.id is null then raise exception 'Payment not found'; end if;
  if v_pay.purpose <> 'package' then raise exception 'Not a package payment'; end if;
  if v_pay.status = 'succeeded' then
    return jsonb_build_object('status', 'already_fulfilled');
  end if;
  v_expected := v_pay.gross_cents - v_pay.credit_applied_cents;
  if p_amount_cents is not null and p_amount_cents <> v_expected then
    raise exception 'Payment amount mismatch';
  end if;
  v_paid := coalesce(p_amount_cents, v_expected);
  select minutes into v_minutes from public.package_products where id = v_pay.package_product_id;
  if v_minutes is null then raise exception 'Package product not found'; end if;
  insert into public.package_minute_ledger (account_id, minutes_delta, entry_type, payment_id, package_product_id, reason, reference, created_by)
    values (v_pay.account_id, v_minutes, 'purchase', p_payment_id, v_pay.package_product_id, 'package purchase (Stripe)', 'pkgissue:' || p_payment_id::text, null)
    on conflict (reference) do nothing;
  update public.payments
     set status = 'succeeded', stripe_paid_cents = v_paid, stripe_charge_id = coalesce(p_charge_id, stripe_charge_id), fulfilled_at = now()
   where id = p_payment_id;
  return jsonb_build_object('status', 'completed', 'minutes', v_minutes);
end;
$$;

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

insert into public.package_products (code, name, minutes, price_cents, is_active, sort_order)
values
  ('pkg_14h', '14 Hour Routine', 840, 14000, true, 1),
  ('pkg_28h', '28 Hour Routine', 1680, 25200, true, 2),
  ('pkg_10h', 'Historical 10h', 600, 19000, false, 9)
on conflict (code) do nothing;

grant usage on schema public to authenticated, anon, service_role;
grant usage on schema auth to authenticated, anon, service_role;
