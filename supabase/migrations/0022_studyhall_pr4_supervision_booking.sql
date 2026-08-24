-- Study Hall PR4: supervision booking model + whole-hour sessions (forward-only).
--
-- Goals:
--   * Normal Study Hall bookings do NOT require an academic subject.
--   * Guides are assigned from all approved available Guides (no specialty filter).
--   * Session rooms open 5 minutes before scheduled start (was 10).
--   * Study Hall customer sessions are WHOLE HOURS only: 60 / 120 / 180 minutes
--     at $12/hour ($12 / $24 / $36). No new paid 30-minute Study Hall bookings.
--   * Preserve PR2 package catalog, PR3 free-trial (60 min / $0 / one per account),
--     ledgers, and Guide compensation architecture.
--
-- Historical safety:
--   * duration_minutes 30 remains allowed on the table for historical rows and
--     legacy subject-matched / "Other" request paths.
--   * Legacy subject-matched booking path remains when p_subject_id is provided.
--   * Unscheduled "Other" requests (null subject + null start) remain for admin review.
--   * tutor_id / tutor_subjects tables and historical rows are untouched.
--   * Guide hourly rates / earnings formula unchanged (amount ∝ duration_minutes).
--
-- Do NOT apply this migration to production from the agent — apply after merge.

-- ---------------------------------------------------------------------------
-- Duration constraint: allow 120 / 180 while keeping historical 30.
-- ---------------------------------------------------------------------------
alter table public.bookings drop constraint if exists bookings_duration_minutes_check;
alter table public.bookings
  add constraint bookings_duration_minutes_check
  check (duration_minutes in (30, 60, 120, 180));

-- ---------------------------------------------------------------------------
-- Session list price: $12/hour for whole-hour Study Hall; keep legacy 30 @ $12.
-- ---------------------------------------------------------------------------
create or replace function public.session_list_price_cents(p_duration integer)
returns integer
language plpgsql
immutable
as $$
begin
  if p_duration = 30 then
    return 1200; -- legacy / historical tutoring support only
  end if;
  if p_duration in (60, 120, 180) then
    return (p_duration / 60) * 1200; -- $12/hour
  end if;
  raise exception 'Invalid duration';
end;
$$;

revoke all on function public.session_list_price_cents(integer) from public;
grant execute on function public.session_list_price_cents(integer) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- booking_quote — same durations + $12/hour authority.
-- ---------------------------------------------------------------------------
create or replace function public.booking_quote(
  p_account uuid, p_duration integer, p_is_free_trial boolean default false
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_price int; v_pkg int; v_credit int; v_pkg_used int := 0; v_credit_used int := 0; v_due int;
begin
  if auth.uid() is not null and auth.uid() <> p_account and not public.is_admin(auth.uid()) then
    raise exception 'Not authorized';
  end if;
  if p_duration not in (30, 60, 120, 180) then raise exception 'Invalid duration'; end if;
  if p_is_free_trial then
    if p_duration <> 60 then raise exception 'The free trial is 60 minutes only'; end if;
    return jsonb_build_object(
      'session_price_cents', 0, 'is_free_trial', true, 'package_minutes_used', 0,
      'credit_cents_used', 0, 'stripe_cents_due', 0, 'funding', 'free_trial');
  end if;
  v_price := public.session_list_price_cents(p_duration);
  v_pkg := coalesce((select sum(minutes_delta) from public.package_minute_ledger where account_id = p_account), 0);
  v_credit := coalesce((select sum(amount_cents) from public.dollar_credit_ledger where account_id = p_account), 0);
  if v_pkg >= p_duration then
    v_pkg_used := p_duration; v_credit_used := 0; v_due := 0;
  else
    v_pkg_used := 0;
    v_credit_used := least(greatest(v_credit, 0), v_price);
    v_due := v_price - v_credit_used;
  end if;
  return jsonb_build_object(
    'session_price_cents', v_price, 'is_free_trial', false,
    'package_minutes_used', v_pkg_used, 'credit_cents_used', v_credit_used,
    'stripe_cents_due', v_due,
    'funding', case when v_pkg_used > 0 then 'package' when v_due = 0 then 'credit' else 'stripe' end,
    'available_package_minutes', v_pkg, 'available_credit_cents', greatest(v_credit, 0));
end;
$$;

revoke all on function public.booking_quote(uuid, integer, boolean) from public;
grant execute on function public.booking_quote(uuid, integer, boolean) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Availability: null subject ⇒ any approved Guide; subject id retains filter.
-- ---------------------------------------------------------------------------
create or replace function public.get_available_slots(
  p_subject_id uuid, p_duration int, p_from timestamptz, p_to timestamptz, p_slot_minutes int default 30
) returns table (slot_start timestamptz)
language sql stable security definer set search_path = public as $$
  with eligible as (
    -- Study Hall (p_subject_id IS NULL): any approved Guide with a timezone.
    -- Legacy subject filter retained when a subject id is supplied (compat/admin).
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

revoke all on function public.get_available_slots(uuid, int, timestamptz, timestamptz, int) from public;
grant execute on function public.get_available_slots(uuid, int, timestamptz, timestamptz, int) to authenticated, service_role;


-- ---------------------------------------------------------------------------
-- Booking + funding: scheduled Study Hall without subject matching.
-- ---------------------------------------------------------------------------
create or replace function public.book_session(
  p_student_id uuid,
  p_subject_id uuid,
  p_other_subject text,
  p_request_note text,
  p_duration int,
  p_start timestamptz,
  p_is_free_trial boolean
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_account uuid;
  v_caller uuid := auth.uid();
  v_price int;
  v_pkg_bal int;
  v_credit_bal int;
  v_pkg_used int := 0;
  v_credit_used int := 0;
  v_stripe_due int := 0;
  v_funding text;
  v_booking_id uuid;
  v_payment_id uuid;
  v_status text;
  v_hold constant interval := interval '15 minutes';
begin
  select account_id into v_account from public.students where id = p_student_id;
  if v_account is null then raise exception 'Student not found'; end if;
  if v_caller is not null and v_caller is distinct from v_account and not public.is_admin(v_caller) then
    raise exception 'Not authorized to book for this student';
  end if;

  perform public.release_expired_holds();

  if p_duration not in (30, 60, 120, 180) then raise exception 'Invalid duration'; end if;
  -- Scheduled Study Hall (null subject + start): whole-hour blocks only.
  if p_subject_id is null and p_start is not null and p_duration not in (60, 120, 180) then
    raise exception 'Study Hall sessions are 1, 2, or 3 hours';
  end if;

  if p_is_free_trial then
    if p_duration <> 60 then raise exception 'The free trial is 60 minutes only'; end if;
    v_booking_id := public.create_booking(
      p_student_id, p_subject_id, p_other_subject, p_request_note, 60, p_start, true);
    insert into public.payments (account_id, purpose, booking_id, gross_cents, stripe_paid_cents, credit_applied_cents, status, fulfilled_at)
      values (v_account, 'booking', v_booking_id, 0, 0, 0, 'succeeded', now())
      returning id into v_payment_id;
    select status::text into v_status from public.bookings where id = v_booking_id;
    return jsonb_build_object(
      'booking_id', v_booking_id, 'payment_id', v_payment_id, 'funding', 'free_trial',
      'session_price_cents', 0, 'package_minutes_used', 0, 'credit_cents_used', 0,
      'stripe_cents_due', 0, 'booking_status', v_status);
  end if;

  v_price := public.session_list_price_cents(p_duration);

  -- Legacy unscheduled "Other" request only when no start time is provided.
  -- Scheduled Study Hall (null subject + start) continues into normal funding.
  if p_subject_id is null and p_start is null then
    v_booking_id := public.create_booking(
      p_student_id, null, p_other_subject, p_request_note, p_duration, null, false);
    insert into public.payments (account_id, purpose, booking_id, gross_cents, status)
      values (v_account, 'booking', v_booking_id, v_price, 'created')
      returning id into v_payment_id;
    return jsonb_build_object(
      'booking_id', v_booking_id, 'payment_id', v_payment_id, 'funding', 'request',
      'session_price_cents', v_price, 'package_minutes_used', 0, 'credit_cents_used', 0,
      'stripe_cents_due', 0, 'booking_status', 'pending');
  end if;

  perform pg_advisory_xact_lock(hashtext('pkgmin:' || v_account::text));
  v_pkg_bal := coalesce((select sum(minutes_delta) from public.package_minute_ledger where account_id = v_account), 0);

  if v_pkg_bal >= p_duration then
    v_funding := 'package'; v_pkg_used := p_duration; v_credit_used := 0; v_stripe_due := 0;
  else
    v_pkg_used := 0;
    perform pg_advisory_xact_lock(hashtext('dollar:' || v_account::text));
    v_credit_bal := coalesce((select sum(amount_cents) from public.dollar_credit_ledger where account_id = v_account), 0);
    v_credit_used := least(greatest(v_credit_bal, 0), v_price);
    v_stripe_due := v_price - v_credit_used;
    v_funding := case when v_stripe_due = 0 then 'credit' else 'stripe' end;
  end if;

  v_booking_id := public.create_booking(
    p_student_id, p_subject_id, p_other_subject, p_request_note, p_duration, p_start, false);

  if v_funding = 'package' then
    insert into public.payments (account_id, purpose, booking_id, gross_cents, stripe_paid_cents, credit_applied_cents, status, fulfilled_at)
      values (v_account, 'booking', v_booking_id, v_price, 0, 0, 'succeeded', now())
      returning id into v_payment_id;
    insert into public.package_minute_ledger (account_id, minutes_delta, entry_type, payment_id, booking_id, reason, reference, created_by)
      values (v_account, -p_duration, 'consumption', v_payment_id, v_booking_id, 'booking paid with package minutes', 'book:' || v_booking_id::text || ':pkg', v_caller);
    update public.bookings set status = 'confirmed', payment_status = 'paid', payment_hold_expires_at = null where id = v_booking_id;
    v_status := 'confirmed';

  elsif v_funding = 'credit' then
    insert into public.payments (account_id, purpose, booking_id, gross_cents, stripe_paid_cents, credit_applied_cents, status, fulfilled_at)
      values (v_account, 'booking', v_booking_id, v_price, 0, v_credit_used, 'succeeded', now())
      returning id into v_payment_id;
    insert into public.dollar_credit_ledger (account_id, amount_cents, entry_type, payment_id, booking_id, reason, reference, created_by)
      values (v_account, -v_credit_used, 'consumption', v_payment_id, v_booking_id, 'booking paid with account credit', 'book:' || v_booking_id::text || ':credit', v_caller);
    update public.bookings set status = 'confirmed', payment_status = 'paid', payment_hold_expires_at = null where id = v_booking_id;
    v_status := 'confirmed';

  else
    insert into public.payments (account_id, purpose, booking_id, gross_cents, stripe_paid_cents, credit_applied_cents, status, expires_at)
      values (v_account, 'booking', v_booking_id, v_price, 0, v_credit_used, 'requires_payment', now() + v_hold)
      returning id into v_payment_id;
    if v_credit_used > 0 then
      insert into public.dollar_credit_ledger (account_id, amount_cents, entry_type, payment_id, booking_id, reason, reference, created_by)
        values (v_account, -v_credit_used, 'consumption', v_payment_id, v_booking_id, 'credit reserved for booking (awaiting Stripe)', 'book:' || v_booking_id::text || ':credit', v_caller);
    end if;
    v_status := 'awaiting_payment';
  end if;

  return jsonb_build_object(
    'booking_id', v_booking_id, 'payment_id', v_payment_id, 'funding', v_funding,
    'session_price_cents', v_price, 'package_minutes_used', v_pkg_used,
    'credit_cents_used', v_credit_used, 'stripe_cents_due', v_stripe_due,
    'booking_status', v_status);
end;
$$;


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

  if p_duration not in (30, 60, 120, 180) then
    raise exception 'Invalid duration';
  end if;
  -- Scheduled Study Hall (null subject + start): whole-hour blocks only.
  -- Legacy subject-matched and unscheduled "Other" paths may still use 30.
  if p_subject_id is null and p_start is not null and p_duration not in (60, 120, 180) then
    raise exception 'Study Hall sessions are 1, 2, or 3 hours';
  end if;

  if p_is_free_trial then
    if p_duration <> 60 then
      raise exception 'The free trial is 60 minutes only';
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
    v_price := public.session_list_price_cents(p_duration);
  end if;

  -- Legacy unscheduled "Other" request (no start): admin review, no Guide match.
  if p_subject_id is null and p_start is null then
    if coalesce(btrim(p_other_subject), '') = '' then
      raise exception 'Describe what your child needs help with';
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

  -- Optional legacy subject catalog (compat). Study Hall passes null.
  if p_subject_id is not null then
    select name, is_active into v_subject_name, v_subject_active
    from public.subjects where id = p_subject_id;
    if v_subject_name is null then
      raise exception 'Subject not found';
    end if;
    if not v_subject_active then
      raise exception 'Subject is not currently available';
    end if;
  else
    v_subject_name := null;
    v_subject_active := true;
  end if;

  if p_start is null then
    raise exception 'A start time is required';
  end if;
  if p_start < now() then
    raise exception 'Cannot book a time in the past';
  end if;
  v_end := p_start + make_interval(mins => p_duration);

  -- Study Hall: assign any approved available Guide (no subject specialty filter).
  -- When a legacy subject_id is provided, keep tutor_subjects filtering for compat.
  for v_tutor in
    select tp.profile_id as tutor_id,
           coalesce(tp.timezone, 'Africa/Lagos') as tz,
           pr.display_name,
           (exists (
              select 1 from public.bookings b2
              where b2.tutor_id = tp.profile_id
                and b2.student_id = p_student_id
                and b2.status = 'completed'
                and (p_subject_id is null or b2.subject_id = p_subject_id)
           )) as is_repeat,
           (select count(*) from public.bookings b3
              where b3.tutor_id = tp.profile_id
                and b3.status in ('pending','confirmed')
                and b3.scheduled_start >= now()) as upcoming_load
    from public.tutor_profiles tp
    join public.profiles pr on pr.id = tp.profile_id
    where tp.status = 'approved'
      and pr.role = 'tutor'
      and coalesce(btrim(tp.timezone), '') <> ''
      and (
        p_subject_id is null
        or exists (
          select 1 from public.tutor_subjects ts
          where ts.tutor_id = tp.profile_id and ts.subject_id = p_subject_id
        )
      )
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

  raise exception 'No Guide is available for that time. Please choose another slot.';
end;
$function$;


-- ---------------------------------------------------------------------------
-- Session room: open 5 minutes before start (was 10). AuthZ unchanged.
-- ---------------------------------------------------------------------------
create or replace function public.authorize_session_join(p_booking uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_bk record; v_uid uuid := auth.uid(); v_role text; v_open timestamptz; v_close timestamptz; v_state text; v_safe text; v_counter text;
begin
  select * into v_bk from public.bookings where id = p_booking;
  if v_bk.id is null then return jsonb_build_object('authorized', false, 'reason', 'not_found'); end if;

  if v_uid is not null and v_uid = v_bk.account_id then v_role := 'student';
  elsif v_uid is not null and v_uid = v_bk.tutor_id then v_role := 'tutor';
  elsif public.is_admin(v_uid) then v_role := 'admin';
  else return jsonb_build_object('authorized', false, 'reason', 'forbidden');
  end if;

  if v_bk.scheduled_start is not null then
    v_open := v_bk.scheduled_start - interval '5 minutes';
    v_close := coalesce(v_bk.scheduled_end, v_bk.scheduled_start + make_interval(mins => coalesce(v_bk.duration_minutes, 0))) + interval '15 minutes';
  end if;

  if v_bk.status <> 'confirmed' then
    v_state := 'not_joinable';
  elsif v_bk.scheduled_start is null then
    v_state := 'not_scheduled';
  elsif now() < v_open then
    v_state := 'too_early';
  elsif now() > v_close then
    v_state := 'too_late';
  else
    v_state := 'open';
  end if;

  -- Admins may enter a confirmed, scheduled session outside the normal window
  -- (operational support). Never for non-confirmed bookings.
  if v_role = 'admin' and v_bk.status = 'confirmed' and v_bk.scheduled_start is not null then
    v_state := 'open';
  end if;

  v_safe := case
    when v_role = 'student' then coalesce(nullif(v_bk.student_first_name, ''), 'Student')
    when v_role = 'tutor' then coalesce(nullif(split_part(coalesce(v_bk.tutor_display_name, ''), ' ', 1), ''), 'Guide')
    else 'Admin' end;
  v_counter := case
    when v_role = 'student' then coalesce(nullif(split_part(coalesce(v_bk.tutor_display_name, ''), ' ', 1), ''), 'Your Guide')
    else coalesce(nullif(v_bk.student_first_name, ''), 'Student') end;

  return jsonb_build_object(
    'authorized', true,
    'role', v_role,
    'status', v_bk.status::text,
    'subject', coalesce(v_bk.subject_name, v_bk.other_subject_text),
    'scheduled_start', v_bk.scheduled_start,
    'scheduled_end', v_bk.scheduled_end,
    'duration_minutes', v_bk.duration_minutes,
    'join_open_at', v_open,
    'join_close_at', v_close,
    'server_now', now(),
    'join_state', v_state,
    'room_name', 'at-' || replace(p_booking::text, '-', ''),
    'is_owner', (v_role = 'admin'),
    'safe_name', v_safe,
    'counterpart', v_counter);
end;
$$;


revoke all on function public.authorize_session_join(uuid) from public;
grant execute on function public.authorize_session_join(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Admin reassignment: allow null-subject scheduled Study Hall bookings.
-- ---------------------------------------------------------------------------
create or replace function public.admin_reassign_tutor(p_booking uuid, p_new_tutor uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_bk record; v_tz text; v_name text; v_ok boolean;
begin
  if not public.is_admin(auth.uid()) then raise exception 'Not authorized'; end if;
  select * into v_bk from public.bookings where id = p_booking for update;
  if v_bk.id is null then raise exception 'Booking not found'; end if;
  if v_bk.scheduled_start is null then
    raise exception 'Only scheduled bookings can be reassigned';
  end if;
  if v_bk.status not in ('pending', 'confirmed') then raise exception 'Cannot reassign a % booking', v_bk.status; end if;
  if p_new_tutor = v_bk.tutor_id then raise exception 'Already assigned to that tutor'; end if;

  -- eligibility: approved tutor qualified for the subject
  select coalesce(tp.timezone, 'Africa/Lagos'), pr.display_name into v_tz, v_name
    from public.tutor_profiles tp join public.profiles pr on pr.id = tp.profile_id
   where tp.profile_id = p_new_tutor and tp.status = 'approved' and pr.role = 'tutor';
  if v_tz is null then raise exception 'Replacement tutor is not an approved tutor'; end if;
  -- Subject qualification only applies to legacy subject-matched bookings.
  if v_bk.subject_id is not null
     and not exists (select 1 from public.tutor_subjects where tutor_id = p_new_tutor and subject_id = v_bk.subject_id) then
    raise exception 'Replacement Guide is not approved for this subject';
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


revoke all on function public.admin_reassign_tutor(uuid, uuid, text) from public;
grant execute on function public.admin_reassign_tutor(uuid, uuid, text) to authenticated, service_role;
