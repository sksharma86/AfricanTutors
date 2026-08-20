-- Phase 8 business-rule correction: the free 30-minute trial is ONE PER
-- CUSTOMER ACCOUNT, not one per student profile. A parent with multiple children
-- gets a single free trial total.
--
-- DATA SAFETY: at authoring time an inspection found 0 accounts with more than
-- one non-cancelled free-trial booking (in fact 0 non-cancelled free trials
-- total), so no historical rows require migration or deletion. All existing
-- booking records are preserved; only the enforcing index and the eligibility
-- checks change. If a target database DID contain account-level duplicates, the
-- unique index below would fail to create, signalling that those rows must be
-- reconciled by hand rather than silently dropped.

-- 1) Account-scoped eligibility helper (authoritative, minimal exposure).
create or replace function public.account_has_used_free_trial(p_account uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from public.bookings b
    where b.account_id = p_account
      and b.is_free_trial
      and b.status <> 'cancelled'
  );
$$;

revoke all on function public.account_has_used_free_trial(uuid) from public;
grant execute on function public.account_has_used_free_trial(uuid) to authenticated, service_role;

-- 2) Swap the hard uniqueness guard from per-student to per-account. The partial
--    unique index is the concurrency backstop: two simultaneous free-trial
--    inserts for the same account can never both commit. A cancelled trial drops
--    out of the index (matching the existing "cancelled restores eligibility"
--    semantics).
drop index if exists public.bookings_one_free_trial_per_student;
create unique index if not exists bookings_one_free_trial_per_account
  on public.bookings (account_id)
  where (is_free_trial and status <> 'cancelled');

-- 3) Enforce the account-level rule inside create_booking (the single authoritative
--    booking creator; book_session delegates free-trial creation to it). An
--    advisory xact lock serializes concurrent free-trial attempts per account so
--    the check-then-insert is race-free; the unique index is the hard backstop.
create or replace function public.create_booking(p_student_id uuid, p_subject_id uuid, p_other_subject text, p_request_note text, p_duration integer, p_start timestamp with time zone, p_is_free_trial boolean)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    -- Free trial is ONE PER ACCOUNT. Serialize concurrent attempts for this
    -- account so exactly one wins; the account-scoped unique index is the hard
    -- backstop.
    perform pg_advisory_xact_lock(hashtext('freetrial:' || v_account::text));
    if public.account_has_used_free_trial(v_account) then
      raise exception 'Your account has already used its free trial';
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
        raise exception 'Your account has already used its free trial';
      end;
    end if;
  end loop;

  raise exception 'No tutor is available for that time. Please choose another slot.';
end;
$function$;
