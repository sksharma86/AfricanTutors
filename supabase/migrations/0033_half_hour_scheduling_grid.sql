-- 0033 — Canonical half-hour Study Hall scheduling grid
--
-- Customer-facing start times must be :00 or :30 in the local timezone used
-- for that booking (student TZ) and in the matched Guide's timezone.
-- Slot generation snaps FORWARD to the next half-hour inside the Guide's
-- actual availability window and never expands that window.
--
-- New Guide availability written by authenticated users must be on-grid.
-- Service role may still insert legacy/off-grid windows so tests can prove
-- the snap-forward rule.

create or replace function public.timestamp_ceil_half_hour(p timestamp)
returns timestamp
language sql
immutable
as $$
  select date_trunc('hour', p)
    + make_interval(mins =>
        case
          when extract(minute from p) = 0 and extract(second from p) = 0 then 0
          when extract(minute from p) < 30 then 30
          when extract(minute from p) = 30 and extract(second from p) = 0 then 30
          else 60
        end
      );
$$;

create or replace function public.timestamp_floor_half_hour(p timestamp)
returns timestamp
language sql
immutable
as $$
  select date_trunc('hour', p)
    + make_interval(mins =>
        case
          when extract(minute from p) = 0 and extract(second from p) = 0 then 0
          when extract(minute from p) < 30 then 0
          when extract(minute from p) = 30 and extract(second from p) = 0 then 30
          else 30
        end
      );
$$;

create or replace function public.instant_is_on_half_hour_grid(p_at timestamptz, p_tz text)
returns boolean
language plpgsql
stable
as $$
declare
  v_local timestamp;
begin
  if p_at is null or coalesce(btrim(p_tz), '') = '' then
    return false;
  end if;
  begin
    v_local := p_at at time zone p_tz;
  exception when others then
    return false;
  end;
  return extract(minute from v_local) in (0, 30)
     and extract(second from v_local) = 0;
end;
$$;

-- Slot generation: snap first start forward onto the half-hour grid in the
-- Guide's local timezone. Step stays a multiple of 30 minutes.
create or replace function public.get_available_slots(
  p_subject_id uuid, p_duration int, p_from timestamptz, p_to timestamptz, p_slot_minutes int default 30
) returns table (slot_start timestamptz)
language sql stable security definer set search_path = public as $$
  with eligible as (
    select tp.profile_id as tutor_id, coalesce(tp.timezone, 'Africa/Lagos') as tz
    from public.tutor_profiles tp
    where tp.status = 'approved'
      and coalesce(btrim(tp.timezone), '') <> ''
      and (
        p_subject_id is null
        or exists (
          select 1 from public.tutor_subjects ts
          where ts.tutor_id = tp.profile_id and ts.subject_id = p_subject_id
        )
      )
  ),
  days as (
    select generate_series(
      (p_from at time zone 'UTC')::date - 1,
      (p_to   at time zone 'UTC')::date + 1,
      interval '1 day'
    )::date as d
  ),
  candidates as (
    select e.tutor_id, e.tz,
      (gs.slot_local at time zone e.tz) as start_utc,
      (gs.slot_local at time zone e.tz) + make_interval(mins => p_duration) as end_utc
    from eligible e
    join public.tutor_availability a on a.tutor_id = e.tutor_id
    join days on extract(dow from days.d)::int = a.day_of_week
    join lateral (
      select
        public.timestamp_ceil_half_hour((days.d + a.start_time)::timestamp) as first_local,
        public.timestamp_floor_half_hour(
          (days.d + a.end_time)::timestamp - make_interval(mins => p_duration)
        ) as last_local
    ) bounds on bounds.last_local >= bounds.first_local
    join lateral generate_series(
      bounds.first_local,
      bounds.last_local,
      make_interval(mins => case
        when coalesce(p_slot_minutes, 30) < 30 then 30
        when p_slot_minutes % 30 = 0 then p_slot_minutes
        else 30
      end)
    ) as gs(slot_local) on true
    where gs.slot_local >= (days.d + a.start_time)
      and gs.slot_local + make_interval(mins => p_duration) <= (days.d + a.end_time)
  )
  select distinct c.start_utc as slot_start
  from candidates c
  where c.start_utc >= p_from
    and c.end_utc   <= p_to
    and not exists (
      select 1 from public.tutor_availability_exceptions ex
      where ex.tutor_id = c.tutor_id and ex.starts_at < c.end_utc and ex.ends_at > c.start_utc
    )
    and not exists (
      select 1 from public.bookings b
      where b.tutor_id = c.tutor_id
        and b.scheduled_start < c.end_utc and b.scheduled_end > c.start_utc
        and (
          b.status in ('confirmed','completed')
          or (b.status = 'pending'
              and (b.payment_hold_expires_at is null or b.payment_hold_expires_at > now()))
        )
    )
  order by slot_start;
$$;

revoke all on function public.get_available_slots(uuid, int, timestamptz, timestamptz, int) from public;
grant execute on function public.get_available_slots(uuid, int, timestamptz, timestamptz, int) to authenticated, service_role;

create or replace function public.enforce_availability_half_hour()
returns trigger
language plpgsql
as $$
begin
  -- PostgREST service-role inserts (live tests / admin seed) may still write
  -- legacy off-grid windows so slot snap-forward can be proven.
  if coalesce(auth.role(), '') = 'service_role'
     or coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role'
     or coalesce(current_setting('request.jwt.claims', true)::json ->> 'role', '') = 'service_role' then
    return NEW;
  end if;
  if extract(minute from NEW.start_time) not in (0, 30)
     or extract(second from NEW.start_time) <> 0
     or extract(minute from NEW.end_time) not in (0, 30)
     or extract(second from NEW.end_time) <> 0 then
    raise exception 'Guide availability must start and end on the half-hour (:00 or :30).';
  end if;
  return NEW;
end;
$$;

drop trigger if exists tutor_availability_half_hour on public.tutor_availability;
create trigger tutor_availability_half_hour
  before insert or update of start_time, end_time on public.tutor_availability
  for each row execute function public.enforce_availability_half_hour();

create or replace function public.enforce_booking_half_hour_start()
returns trigger
language plpgsql
as $$
declare
  v_student_tz text;
  v_tutor_tz text;
begin
  if NEW.scheduled_start is null then
    return NEW;
  end if;

  if NEW.student_id is not null then
    select timezone into v_student_tz from public.students where id = NEW.student_id;
    if coalesce(btrim(v_student_tz), '') <> ''
       and not public.instant_is_on_half_hour_grid(NEW.scheduled_start, v_student_tz) then
      raise exception 'Study Hall start times must be on the half-hour (:00 or :30) in the local booking timezone.';
    end if;
  end if;

  if NEW.tutor_id is not null then
    select coalesce(nullif(btrim(timezone), ''), 'Africa/Lagos')
      into v_tutor_tz
      from public.tutor_profiles
     where profile_id = NEW.tutor_id;
    if v_tutor_tz is not null
       and not public.instant_is_on_half_hour_grid(NEW.scheduled_start, v_tutor_tz) then
      raise exception 'Study Hall start times must be on the half-hour (:00 or :30) in the Guide timezone.';
    end if;
  end if;

  return NEW;
end;
$$;

drop trigger if exists bookings_half_hour_start on public.bookings;
create trigger bookings_half_hour_start
  before insert or update of scheduled_start, student_id, tutor_id on public.bookings
  for each row execute function public.enforce_booking_half_hour_start();
