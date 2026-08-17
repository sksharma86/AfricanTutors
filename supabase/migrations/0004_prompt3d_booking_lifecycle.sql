-- =============================================================================
-- African Tutors — Prompt 3D: Booking lifecycle hardening + Stripe readiness
-- =============================================================================
-- Additive on top of 3A/3B/3C. No destructive changes. Refines paid-booking
-- semantics and adds a payment-hold expiration model so unpaid holds never
-- block a tutor's availability forever.
--
-- Authoritative booking/payment state machine:
--   FREE TRIAL:            status = confirmed,  payment_status = not_required
--   PAID (pre-payment):    status = pending,    payment_status = awaiting_payment,
--                          payment_hold_expires_at = now() + hold window
--   PAID (after Stripe):   status = confirmed,  payment_status = paid    (Prompt 4)
--   HOLD EXPIRED:          status = expired     (slot released; not blocking)
--   "OTHER" REQUEST:       status = pending,    payment_status per free/paid,
--                          no tutor, no scheduled time (admin triage)
--
-- Idempotent.
-- =============================================================================

-- New terminal status for an unpaid paid-hold that timed out. (ADD VALUE runs
-- in its own autocommit statement; safe with psql non-transactional apply.)
alter type public.booking_status add value if not exists 'expired';

-- Short-lived payment hold for paid bookings awaiting Stripe (Prompt 4).
alter table public.bookings add column if not exists payment_hold_expires_at timestamptz;

-- ---------------------------------------------------------------------------
-- release_expired_holds — flips timed-out unpaid paid-holds to 'expired' so
-- their slots free up. Prompt 4 can also call this from a scheduled job; it is
-- additionally called at the top of create_booking so availability is truthful.
-- ---------------------------------------------------------------------------
create or replace function public.release_expired_holds()
returns integer
language plpgsql security definer set search_path = public as $$
declare v_count integer;
begin
  update public.bookings
     set status = 'expired'
   where status = 'pending'
     and payment_status = 'awaiting_payment'
     and payment_hold_expires_at is not null
     and payment_hold_expires_at < now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function public.release_expired_holds() from public;
grant execute on function public.release_expired_holds() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- tutor_is_available — a booking blocks only when it is confirmed/completed or
-- a still-live pending hold; expired holds (and timeless "Other" pending rows)
-- do not block.
-- ---------------------------------------------------------------------------
create or replace function public.tutor_is_available(
  p_tutor uuid, p_tz text, p_start timestamptz, p_end timestamptz
) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  v_ls timestamp := p_start at time zone p_tz;
  v_le timestamp := p_end   at time zone p_tz;
begin
  if v_ls::date <> v_le::date then
    return false;
  end if;
  if not exists (
    select 1 from public.tutor_availability a
    where a.tutor_id = p_tutor
      and a.day_of_week = extract(dow from v_ls)::int
      and a.start_time <= v_ls::time
      and a.end_time   >= v_le::time
  ) then
    return false;
  end if;
  if exists (
    select 1 from public.tutor_availability_exceptions ex
    where ex.tutor_id = p_tutor and ex.starts_at < p_end and ex.ends_at > p_start
  ) then
    return false;
  end if;
  if exists (
    select 1 from public.bookings b
    where b.tutor_id = p_tutor
      and b.scheduled_start < p_end and b.scheduled_end > p_start
      and (
        b.status in ('confirmed','completed')
        or (b.status = 'pending'
            and (b.payment_hold_expires_at is null or b.payment_hold_expires_at > now()))
      )
  ) then
    return false;
  end if;
  return true;
end;
$$;
revoke all on function public.tutor_is_available(uuid,text,timestamptz,timestamptz) from public;
grant execute on function public.tutor_is_available(uuid,text,timestamptz,timestamptz) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- get_available_slots — same blocking rule (ignore expired holds).
-- ---------------------------------------------------------------------------
create or replace function public.get_available_slots(
  p_subject_id uuid, p_duration int, p_from timestamptz, p_to timestamptz, p_slot_minutes int default 30
) returns table (slot_start timestamptz)
language sql stable security definer set search_path = public as $$
  with eligible as (
    select tp.profile_id as tutor_id, coalesce(tp.timezone, 'Africa/Lagos') as tz
    from public.tutor_profiles tp
    join public.tutor_subjects ts
      on ts.tutor_id = tp.profile_id and ts.subject_id = p_subject_id
    where tp.status = 'approved'
      and coalesce(btrim(tp.timezone), '') <> ''
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
    join lateral generate_series(
      (days.d + a.start_time)::timestamp,
      (days.d + a.end_time)::timestamp - make_interval(mins => p_duration),
      make_interval(mins => greatest(p_slot_minutes, 5))
    ) as gs(slot_local) on true
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
revoke all on function public.get_available_slots(uuid,int,timestamptz,timestamptz,int) from public;
grant execute on function public.get_available_slots(uuid,int,timestamptz,timestamptz,int) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- create_booking — paid bookings are now created PENDING with a payment hold
-- (not confirmed). Free trials remain confirmed/not_required. Expired holds are
-- released first so their slots are bookable. Payment hold window is a
-- configurable development default (15 minutes) — not final public policy.
-- ---------------------------------------------------------------------------
create or replace function public.create_booking(
  p_student_id uuid,
  p_subject_id uuid,
  p_other_subject text,
  p_request_note text,
  p_duration int,
  p_start timestamptz,
  p_is_free_trial boolean
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_account uuid;
  v_first_name text;
  v_grade text;
  v_end timestamptz;
  v_price int;
  v_subject_name text;
  v_subject_active boolean;
  v_tutor record;
  v_booking_id uuid;
  v_caller uuid := auth.uid();
  v_hold constant interval := interval '15 minutes';  -- dev default; configurable
begin
  perform public.release_expired_holds();

  select account_id, split_part(full_name, ' ', 1), grade_level
    into v_account, v_first_name, v_grade
  from public.students where id = p_student_id;
  if v_account is null then
    raise exception 'Student not found';
  end if;
  if v_caller is distinct from v_account and not public.is_admin(v_caller) then
    raise exception 'Not authorized to book for this student';
  end if;

  if p_duration not in (30, 60) then
    raise exception 'Invalid duration';
  end if;

  if p_is_free_trial then
    if p_duration <> 30 then
      raise exception 'The free trial is 30 minutes only';
    end if;
    if public.has_used_free_trial(p_student_id) then
      raise exception 'This student has already used their free trial';
    end if;
    v_price := 0;
  else
    v_price := case p_duration when 30 then 1200 when 60 then 2000 end;
  end if;

  -- "Other" (unlisted subject) → admin-review request (no tutor guess).
  if p_subject_id is null then
    if coalesce(btrim(p_other_subject), '') = '' then
      raise exception 'Describe the subject you need help with';
    end if;
    insert into public.bookings (
      student_id, account_id, other_subject_text, request_note, duration_minutes,
      is_free_trial, price_cents, status, payment_status,
      student_first_name, student_grade
    ) values (
      p_student_id, v_account, p_other_subject, p_request_note, p_duration,
      p_is_free_trial, v_price, 'pending',
      case when p_is_free_trial then 'not_required' else 'awaiting_payment' end,
      v_first_name, v_grade
    ) returning id into v_booking_id;
    return v_booking_id;
  end if;

  select name, is_active into v_subject_name, v_subject_active
  from public.subjects where id = p_subject_id;
  if v_subject_name is null then
    raise exception 'Subject not found';
  end if;
  if not v_subject_active then
    raise exception 'Subject is not currently available';
  end if;

  if p_start is null then
    raise exception 'A start time is required';
  end if;
  if p_start < now() then
    raise exception 'Cannot book a time in the past';
  end if;
  v_end := p_start + make_interval(mins => p_duration);

  for v_tutor in
    select tp.profile_id as tutor_id,
           coalesce(tp.timezone, 'Africa/Lagos') as tz,
           pr.display_name,
           (exists (
              select 1 from public.bookings b2
              where b2.tutor_id = tp.profile_id
                and b2.student_id = p_student_id
                and b2.subject_id = p_subject_id
                and b2.status = 'completed'
           )) as is_repeat,
           (select count(*) from public.bookings b3
              where b3.tutor_id = tp.profile_id
                and b3.status in ('pending','confirmed')
                and b3.scheduled_start >= now()) as upcoming_load
    from public.tutor_profiles tp
    join public.tutor_subjects ts on ts.tutor_id = tp.profile_id and ts.subject_id = p_subject_id
    join public.profiles pr on pr.id = tp.profile_id
    where tp.status = 'approved'
      and pr.role = 'tutor'
      and coalesce(btrim(tp.timezone), '') <> ''
    order by is_repeat desc, upcoming_load asc, tp.profile_id asc
  loop
    if public.tutor_is_available(v_tutor.tutor_id, v_tutor.tz, p_start, v_end) then
      begin
        insert into public.bookings (
          student_id, account_id, tutor_id, subject_id, request_note,
          scheduled_start, scheduled_end, duration_minutes, is_free_trial,
          price_cents, status, payment_status, payment_hold_expires_at,
          student_first_name, student_grade, subject_name, tutor_display_name
        ) values (
          p_student_id, v_account, v_tutor.tutor_id, p_subject_id, p_request_note,
          p_start, v_end, p_duration, p_is_free_trial,
          v_price,
          (case when p_is_free_trial then 'confirmed' else 'pending' end)::public.booking_status,
          case when p_is_free_trial then 'not_required' else 'awaiting_payment' end,
          case when p_is_free_trial then null else now() + v_hold end,
          v_first_name, v_grade, v_subject_name, v_tutor.display_name
        ) returning id into v_booking_id;
        return v_booking_id;
      exception when exclusion_violation then
        continue;
      when unique_violation then
        raise exception 'This student has already used their free trial';
      end;
    end if;
  end loop;

  raise exception 'No tutor is available for that time. Please choose another slot.';
end;
$$;

-- Reload PostgREST's schema cache so the new booking_status value is recognized.
notify pgrst, 'reload schema';
