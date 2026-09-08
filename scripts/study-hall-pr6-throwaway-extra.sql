-- Stubs so 0043 can run on the booking throwaway DB.
-- Never point this at production or the shared demo.

create table if not exists public.session_presence (
  booking_id uuid primary key references public.bookings (id),
  student_first_joined_at timestamptz,
  student_last_seen_at timestamptz,
  student_last_left_at timestamptz,
  tutor_first_joined_at timestamptz,
  tutor_last_seen_at timestamptz,
  tutor_last_left_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.tutor_earnings (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references public.profiles (id),
  booking_id uuid unique references public.bookings (id),
  duration_minutes integer not null default 60,
  rate_cents_per_hour integer not null default 1000,
  amount_cents integer not null default 0,
  status text not null default 'earned',
  earned_at timestamptz,
  paid_at timestamptz,
  reason text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tutor_profiles add column if not exists comp_rate_cents_per_hour integer;
update public.tutor_profiles set comp_rate_cents_per_hour = coalesce(comp_rate_cents_per_hour, 1000)
 where comp_rate_cents_per_hour is null;

create or replace function public.log_admin_action(
  p_action text, p_entity_type text, p_entity_id uuid,
  p_prev jsonb, p_new jsonb, p_reason text
) returns void language sql security definer set search_path = public as $$
  insert into public.financial_audit_log (actor_id, action, entity_type, entity_id, previous_state, new_state, reason)
  values (auth.uid(), p_action, p_entity_type, p_entity_id, p_prev, p_new, p_reason);
$$;

create or replace function public.try_full_earning(p_booking uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_tutor uuid;
  v_duration int;
  v_rate int;
  v_amount int;
begin
  select tutor_id, duration_minutes into v_tutor, v_duration from public.bookings where id = p_booking;
  if v_tutor is null then return; end if;
  v_duration := coalesce(nullif(v_duration, 0), 60);
  select coalesce(comp_rate_cents_per_hour, 1000) into v_rate
    from public.tutor_profiles where profile_id = v_tutor;
  v_rate := coalesce(v_rate, 1000);
  v_amount := round(v_rate::numeric * v_duration / 60.0)::integer;
  insert into public.tutor_earnings (
    tutor_id, booking_id, duration_minutes, rate_cents_per_hour, amount_cents, status, earned_at, reason, created_by
  ) values (v_tutor, p_booking, v_duration, v_rate, v_amount, 'earned', now(), p_reason, auth.uid())
  on conflict (booking_id) do nothing;
end;
$$;

revoke all on function public.try_full_earning(uuid, text) from public;
revoke all on function public.try_full_earning(uuid, text) from anon;
revoke all on function public.try_full_earning(uuid, text) from authenticated;
grant execute on function public.try_full_earning(uuid, text) to service_role;
