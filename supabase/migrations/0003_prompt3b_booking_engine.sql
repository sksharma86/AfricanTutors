-- =============================================================================
-- African Tutors — Prompt 3B: Booking engine hardening
-- =============================================================================
-- Additive on top of Prompt 3A (0002). Hardens the two core booking functions:
--   * get_available_slots  — configurable slot interval; slots aligned to the
--     interval, whole duration must fit inside availability, minus exceptions
--     and existing bookings, within the caller's horizon window.
--   * create_booking       — managed matching with SAME-SUBJECT repeat-tutor
--     continuity (only if that tutor is still approved, still qualified, and
--     actually available), then fair least-workload distribution, deterministic
--     tie-break; server-authoritative pricing + free-trial rules.
--
-- No schema/table changes. RLS, constraints, and Phase 2 are untouched.
-- Idempotent (CREATE OR REPLACE / DROP FUNCTION IF EXISTS).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- get_available_slots — add a configurable slot interval (p_slot_minutes,
-- default 30). Callers passing four args still work via the default.
-- ---------------------------------------------------------------------------
drop function if exists public.get_available_slots(uuid, int, timestamptz, timestamptz);

create or replace function public.get_available_slots(
  p_subject_id uuid,
  p_duration int,
  p_from timestamptz,
  p_to timestamptz,
  p_slot_minutes int default 30
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
        and b.status in ('pending','confirmed','completed')
        and b.scheduled_start < c.end_utc and b.scheduled_end > c.start_utc
    )
  order by slot_start;
$$;

-- Lock down execute: not callable by anon/public (login required to see slots).
revoke all on function public.get_available_slots(uuid,int,timestamptz,timestamptz,int) from public;
grant execute on function public.get_available_slots(uuid,int,timestamptz,timestamptz,int) to authenticated, service_role;
revoke all on function public.tutor_is_available(uuid,text,timestamptz,timestamptz) from public;
grant execute on function public.tutor_is_available(uuid,text,timestamptz,timestamptz) to authenticated, service_role;
revoke all on function public.has_used_free_trial(uuid) from public;
grant execute on function public.has_used_free_trial(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- create_booking — hardened managed matching. Repeat-tutor continuity now
-- requires a *completed* prior session with the SAME student AND SAME subject,
-- and the tutor must still be approved + qualified + available (verified in the
-- availability loop, so continuity never overrides scheduling correctness).
-- Pricing and free-trial rules remain server-authoritative.
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
begin
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

  -- Pricing + free-trial rules (server-authoritative; client never sets price).
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

  -- "Other" (unlisted subject): create an admin-review request. We do NOT guess
  -- a tutor because subject qualification cannot be verified. See DECISIONS.md.
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

  -- Eligible tutors: approved + qualified for subject + valid timezone.
  -- Order: same-subject repeat-tutor continuity, then least upcoming workload,
  -- then deterministic id tie-break (predictable under concurrency).
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
          price_cents, status, payment_status,
          student_first_name, student_grade, subject_name, tutor_display_name
        ) values (
          p_student_id, v_account, v_tutor.tutor_id, p_subject_id, p_request_note,
          p_start, v_end, p_duration, p_is_free_trial,
          v_price, 'confirmed',
          case when p_is_free_trial then 'not_required' else 'awaiting_payment' end,
          v_first_name, v_grade, v_subject_name, v_tutor.display_name
        ) returning id into v_booking_id;
        return v_booking_id;
      exception when exclusion_violation then
        continue;  -- tutor booked concurrently; try the next eligible tutor
      when unique_violation then
        raise exception 'This student has already used their free trial';
      end;
    end if;
  end loop;

  raise exception 'No tutor is available for that time. Please choose another slot.';
end;
$$;
