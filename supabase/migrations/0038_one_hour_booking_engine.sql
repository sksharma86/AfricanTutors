-- =============================================================================
-- Study Hall booking engine — 60 minutes + 365 daily entitlement (PR3)
-- =============================================================================
-- Additive. Does NOT rewrite historical bookings or duration_minutes rows.
-- Customer scheduled Study Hall (null subject + start) is exactly 60 minutes.
-- Funding is decided inside book_session in one transaction.
-- 365 consume happens AFTER create_booking succeeds, in the same transaction.
-- Cancel does not delete study_hall_365_day_usage (already ON DELETE SET NULL).
-- =============================================================================

alter table public.bookings
  add column if not exists funding_source text;

alter table public.bookings drop constraint if exists bookings_funding_source_check;
alter table public.bookings
  add constraint bookings_funding_source_check
  check (funding_source is null or funding_source in (
    'free_trial', 'study_hall_365', 'prepaid', 'credit', 'payg', 'request'
  ));

-- ---------------------------------------------------------------------------
-- create_booking — customer Study Hall start must be 60 minutes
-- ---------------------------------------------------------------------------
create or replace function public.create_booking(
  p_student_id uuid,
  p_subject_id uuid,
  p_other_subject text,
  p_request_note text,
  p_duration integer,
  p_start timestamp with time zone,
  p_is_free_trial boolean,
  p_student_ids uuid[] default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
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
  v_hold constant interval := interval '15 minutes';
  v_ids uuid[];
  v_id uuid;
  v_acct uuid;
begin
  perform public.release_expired_holds();

  v_ids := public.normalize_student_ids(coalesce(p_student_ids, array[p_student_id]));
  if p_student_id is not null and not (p_student_id = any(v_ids)) then
    v_ids := array[p_student_id] || v_ids;
    v_ids := public.normalize_student_ids(v_ids);
  end if;
  if coalesce(array_length(v_ids, 1), 0) < 1 then
    raise exception 'Student not found';
  end if;
  if array_length(v_ids, 1) > 3 then
    raise exception 'Up to 3 children can join the same Study Hall.';
  end if;

  p_student_id := v_ids[1];

  foreach v_id in array v_ids loop
    select account_id into v_acct from public.students where id = v_id;
    if v_acct is null then raise exception 'Student not found'; end if;
    if v_account is null then v_account := v_acct; end if;
    if v_acct is distinct from v_account then
      raise exception 'Not authorized to book for this student';
    end if;
  end loop;

  select split_part(full_name, ' ', 1), grade_level
    into v_first_name, v_grade
  from public.students where id = p_student_id;

  if v_caller is not null and v_caller is distinct from v_account and not public.is_admin(v_caller) then
    raise exception 'Not authorized to book for this student';
  end if;

  if p_duration not in (30, 60, 120, 180) then
    raise exception 'Invalid duration';
  end if;
  -- New customer Study Halls are 60 minutes. Historical 120/180 rows stay valid.
  if p_subject_id is null and p_start is not null and p_duration <> 60 then
    raise exception 'Study Hall sessions are 60 minutes';
  end if;

  if p_is_free_trial then
    if p_duration <> 60 then
      raise exception 'The free trial is 60 minutes only';
    end if;
    perform pg_advisory_xact_lock(hashtext('freetrial:' || v_account::text));
    if public.account_has_used_free_trial(v_account) then
      raise exception 'Your account has already used its free trial';
    end if;
    v_price := 0;
  else
    v_price := public.session_list_price_cents(p_duration);
  end if;

  if p_subject_id is null and p_start is null then
    if coalesce(btrim(p_other_subject), '') = '' then
      raise exception 'Describe what your child needs help with';
    end if;
    insert into public.bookings (
      student_id, account_id, other_subject_text, request_note, duration_minutes,
      is_free_trial, price_cents, status, payment_status,
      student_first_name, student_grade, child_count
    ) values (
      p_student_id, v_account, p_other_subject, p_request_note, p_duration,
      p_is_free_trial, v_price, 'pending',
      case when p_is_free_trial then 'not_required' else 'awaiting_payment' end,
      v_first_name, v_grade, array_length(v_ids, 1)
    ) returning id into v_booking_id;
    perform public.attach_booking_children(v_booking_id, v_ids);
    return v_booking_id;
  end if;

  if p_subject_id is not null then
    select name, is_active into v_subject_name, v_subject_active
    from public.subjects where id = p_subject_id;
    if v_subject_name is null then raise exception 'Subject not found'; end if;
    if not v_subject_active then raise exception 'Subject is not currently available'; end if;
  else
    v_subject_name := null;
    v_subject_active := true;
  end if;

  if p_start is null then raise exception 'A start time is required'; end if;
  if p_start < now() then raise exception 'Cannot book a time in the past'; end if;
  v_end := p_start + make_interval(mins => p_duration);

  if public.household_students_overlap(v_ids, p_start, v_end, null) then
    raise exception 'One of these children already has a Study Hall at that time.';
  end if;

  for v_tutor in
    select tp.profile_id as tutor_id,
           coalesce(tp.timezone, 'Africa/Lagos') as tz,
           pr.display_name,
           (exists (
              select 1 from public.bookings b2
              where b2.tutor_id = tp.profile_id
                and b2.status = 'completed'
                and (p_subject_id is null or b2.subject_id = p_subject_id)
                and (
                  b2.student_id = any(v_ids)
                  or exists (
                    select 1 from public.booking_children bc
                     where bc.booking_id = b2.id and bc.student_id = any(v_ids)
                  )
                )
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
          student_first_name, student_grade, subject_name, tutor_display_name,
          child_count
        ) values (
          p_student_id, v_account, v_tutor.tutor_id, p_subject_id, p_request_note,
          p_start, v_end, p_duration, p_is_free_trial,
          v_price,
          (case when p_is_free_trial then 'confirmed' else 'pending' end)::public.booking_status,
          case when p_is_free_trial then 'not_required' else 'awaiting_payment' end,
          case when p_is_free_trial then null else now() + v_hold end,
          v_first_name, v_grade, v_subject_name, v_tutor.display_name,
          array_length(v_ids, 1)
        ) returning id into v_booking_id;
        perform public.attach_booking_children(v_booking_id, v_ids);
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
$$;

-- ---------------------------------------------------------------------------
-- book_session — 60-min customer Study Hall + explicit funding + 365 consume
-- ---------------------------------------------------------------------------
create or replace function public.book_session(
  p_student_id uuid,
  p_subject_id uuid,
  p_other_subject text,
  p_request_note text,
  p_duration int,
  p_start timestamptz,
  p_is_free_trial boolean,
  p_student_ids uuid[] default null
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
  v_funding_source text;
  v_booking_id uuid;
  v_payment_id uuid;
  v_status text;
  v_hold constant interval := interval '15 minutes';
  v_ids uuid[];
  v_id uuid;
  v_acct uuid;
  v_use_free boolean := false;
  v_ent jsonb;
  v_usage uuid;
  v_sub public.study_hall_365_subscriptions;
  v_tz text;
  v_local date;
begin
  v_ids := public.normalize_student_ids(coalesce(p_student_ids, array[p_student_id]));
  if p_student_id is not null and not (p_student_id = any(v_ids)) then
    v_ids := array[p_student_id] || v_ids;
    v_ids := public.normalize_student_ids(v_ids);
  end if;
  if coalesce(array_length(v_ids, 1), 0) < 1 then raise exception 'Student not found'; end if;
  if array_length(v_ids, 1) > 3 then
    raise exception 'Up to 3 children can join the same Study Hall.';
  end if;
  p_student_id := v_ids[1];

  foreach v_id in array v_ids loop
    select account_id into v_acct from public.students where id = v_id;
    if v_acct is null then raise exception 'Student not found'; end if;
    if v_account is null then v_account := v_acct; end if;
    if v_acct is distinct from v_account then
      raise exception 'Not authorized to book for this student';
    end if;
  end loop;

  if v_caller is not null and v_caller is distinct from v_account and not public.is_admin(v_caller) then
    raise exception 'Not authorized to book for this student';
  end if;
  if v_caller is not null and exists (
    select 1 from public.profiles p where p.id = v_caller and p.role = 'tutor'
  ) then
    raise exception 'Guides cannot book parent Study Halls';
  end if;

  perform public.release_expired_holds();

  if p_duration not in (30, 60, 120, 180) then raise exception 'Invalid duration'; end if;
  if p_subject_id is null and p_start is not null and p_duration <> 60 then
    raise exception 'Study Hall sessions are 60 minutes';
  end if;

  -- Unused free first Study Hall is used automatically for a scheduled booking.
  if p_subject_id is null and p_start is not null then
    v_use_free := not public.account_has_used_free_trial(v_account);
    if p_is_free_trial and not v_use_free then
      raise exception 'Your account has already used its free trial';
    end if;
  elsif p_is_free_trial then
    v_use_free := true;
  end if;

  if v_use_free then
    if p_duration <> 60 then raise exception 'The free trial is 60 minutes only'; end if;
    v_booking_id := public.create_booking(
      p_student_id, p_subject_id, p_other_subject, p_request_note, 60, p_start, true, v_ids);
    insert into public.payments (account_id, purpose, booking_id, gross_cents, stripe_paid_cents, credit_applied_cents, status, fulfilled_at)
      values (v_account, 'booking', v_booking_id, 0, 0, 0, 'succeeded', now())
      returning id into v_payment_id;
    update public.bookings set funding_source = 'free_trial' where id = v_booking_id;
    select status::text into v_status from public.bookings where id = v_booking_id;
    if current_setting('studyhall.debug_fail_after_funding', true) = '1' then
      raise exception 'debug_fail_after_funding';
    end if;
    return jsonb_build_object(
      'booking_id', v_booking_id, 'payment_id', v_payment_id, 'funding', 'free_trial',
      'funding_source', 'free_trial',
      'session_price_cents', 0, 'package_minutes_used', 0, 'credit_cents_used', 0,
      'stripe_cents_due', 0, 'booking_status', v_status);
  end if;

  -- Study Hall 365: evaluate the booking start's local date + instant, then book, then consume.
  if p_subject_id is null and p_start is not null then
    v_tz := public.resolve_account_timezone(v_account);
    begin
      v_local := (p_start at time zone v_tz)::date;
    exception when others then
      v_local := (p_start at time zone 'America/Chicago')::date;
    end;
    v_ent := public.get_study_hall_365_entitlement(v_account, v_local, now(), p_start);
    if coalesce((v_ent->>'entitled')::boolean, false) then
      v_booking_id := public.create_booking(
        p_student_id, p_subject_id, p_other_subject, p_request_note, 60, p_start, false, v_ids);

      select * into v_sub
        from public.study_hall_365_subscriptions
       where account_id = v_account
         and ended_at is null
         and public.study_hall_365_status_entitled(
           status, cancel_at_period_end, current_period_end, ended_at, now()
         )
         and p_start >= current_period_start
         and p_start < current_period_end
       order by current_period_end desc
       limit 1
       for update;

      if v_sub.id is null then
        raise exception 'Study Hall 365 is not available for that time';
      end if;

      insert into public.study_hall_365_day_usage (
        account_id, subscription_id, local_date, time_zone, booking_id
      ) values (
        v_account, v_sub.id, v_local, v_tz, v_booking_id
      )
      on conflict (account_id, local_date) do nothing
      returning id into v_usage;

      if v_usage is null then
        raise exception 'This day is already included with Study Hall 365';
      end if;

      insert into public.payments (account_id, purpose, booking_id, gross_cents, stripe_paid_cents, credit_applied_cents, status, fulfilled_at)
        values (v_account, 'booking', v_booking_id, 0, 0, 0, 'succeeded', now())
        returning id into v_payment_id;
      update public.bookings
         set status = 'confirmed',
             payment_status = 'paid',
             payment_hold_expires_at = null,
             price_cents = 0,
             funding_source = 'study_hall_365'
       where id = v_booking_id;
      if current_setting('studyhall.debug_fail_after_funding', true) = '1' then
        raise exception 'debug_fail_after_funding';
      end if;
      return jsonb_build_object(
        'booking_id', v_booking_id, 'payment_id', v_payment_id, 'funding', 'study_hall_365',
        'funding_source', 'study_hall_365',
        'session_price_cents', 0, 'package_minutes_used', 0, 'credit_cents_used', 0,
        'stripe_cents_due', 0, 'booking_status', 'confirmed');
    end if;
  end if;

  v_price := public.session_list_price_cents(p_duration);

  if p_subject_id is null and p_start is null then
    v_booking_id := public.create_booking(
      p_student_id, null, p_other_subject, p_request_note, p_duration, null, false, v_ids);
    insert into public.payments (account_id, purpose, booking_id, gross_cents, status)
      values (v_account, 'booking', v_booking_id, v_price, 'created')
      returning id into v_payment_id;
    update public.bookings set funding_source = 'request' where id = v_booking_id;
    return jsonb_build_object(
      'booking_id', v_booking_id, 'payment_id', v_payment_id, 'funding', 'request',
      'funding_source', 'request',
      'session_price_cents', v_price, 'package_minutes_used', 0, 'credit_cents_used', 0,
      'stripe_cents_due', 0, 'booking_status', 'pending');
  end if;

  perform pg_advisory_xact_lock(hashtext('pkgmin:' || v_account::text));
  v_pkg_bal := coalesce((select sum(minutes_delta) from public.package_minute_ledger where account_id = v_account), 0);

  if v_pkg_bal >= p_duration then
    v_funding := 'package';
    v_funding_source := 'prepaid';
    v_pkg_used := p_duration; v_credit_used := 0; v_stripe_due := 0;
  else
    v_pkg_used := 0;
    perform pg_advisory_xact_lock(hashtext('dollar:' || v_account::text));
    v_credit_bal := coalesce((select sum(amount_cents) from public.dollar_credit_ledger where account_id = v_account), 0);
    v_credit_used := least(greatest(v_credit_bal, 0), v_price);
    v_stripe_due := v_price - v_credit_used;
    if v_stripe_due = 0 then
      v_funding := 'credit';
      v_funding_source := 'credit';
    else
      v_funding := 'stripe';
      v_funding_source := 'payg';
    end if;
  end if;

  v_booking_id := public.create_booking(
    p_student_id, p_subject_id, p_other_subject, p_request_note, p_duration, p_start, false, v_ids);

  if v_funding = 'package' then
    insert into public.payments (account_id, purpose, booking_id, gross_cents, stripe_paid_cents, credit_applied_cents, status, fulfilled_at)
      values (v_account, 'booking', v_booking_id, v_price, 0, 0, 'succeeded', now())
      returning id into v_payment_id;
    insert into public.package_minute_ledger (account_id, minutes_delta, entry_type, payment_id, booking_id, reason, reference, created_by)
      values (v_account, -p_duration, 'consumption', v_payment_id, v_booking_id, 'booking paid with package minutes', 'book:' || v_booking_id::text || ':pkg', v_caller);
    update public.bookings
       set status = 'confirmed', payment_status = 'paid', payment_hold_expires_at = null, funding_source = 'prepaid'
     where id = v_booking_id;
    v_status := 'confirmed';

  elsif v_funding = 'credit' then
    insert into public.payments (account_id, purpose, booking_id, gross_cents, stripe_paid_cents, credit_applied_cents, status, fulfilled_at)
      values (v_account, 'booking', v_booking_id, v_price, 0, v_credit_used, 'succeeded', now())
      returning id into v_payment_id;
    insert into public.dollar_credit_ledger (account_id, amount_cents, entry_type, payment_id, booking_id, reason, reference, created_by)
      values (v_account, -v_credit_used, 'consumption', v_payment_id, v_booking_id, 'booking paid with account credit', 'book:' || v_booking_id::text || ':credit', v_caller);
    update public.bookings
       set status = 'confirmed', payment_status = 'paid', payment_hold_expires_at = null, funding_source = 'credit'
     where id = v_booking_id;
    v_status := 'confirmed';

  else
    insert into public.payments (account_id, purpose, booking_id, gross_cents, stripe_paid_cents, credit_applied_cents, status, expires_at)
      values (v_account, 'booking', v_booking_id, v_price, 0, v_credit_used, 'requires_payment', now() + v_hold)
      returning id into v_payment_id;
    if v_credit_used > 0 then
      insert into public.dollar_credit_ledger (account_id, amount_cents, entry_type, payment_id, booking_id, reason, reference, created_by)
        values (v_account, -v_credit_used, 'consumption', v_payment_id, v_booking_id, 'credit reserved for booking (awaiting Stripe)', 'book:' || v_booking_id::text || ':credit', v_caller);
    end if;
    update public.bookings set funding_source = 'payg' where id = v_booking_id;
    v_status := 'awaiting_payment';
  end if;

  if current_setting('studyhall.debug_fail_after_funding', true) = '1' then
    raise exception 'debug_fail_after_funding';
  end if;

  return jsonb_build_object(
    'booking_id', v_booking_id, 'payment_id', v_payment_id, 'funding', v_funding,
    'funding_source', v_funding_source,
    'session_price_cents', v_price, 'package_minutes_used', v_pkg_used,
    'credit_cents_used', v_credit_used, 'stripe_cents_due', v_stripe_due,
    'booking_status', v_status);
end;
$$;

revoke all on function public.book_session(uuid, uuid, text, text, integer, timestamp with time zone, boolean, uuid[]) from public;
grant execute on function public.book_session(uuid, uuid, text, text, integer, timestamp with time zone, boolean, uuid[])
  to authenticated, service_role;

revoke all on function public.create_booking(uuid, uuid, text, text, integer, timestamp with time zone, boolean, uuid[]) from public;
grant execute on function public.create_booking(uuid, uuid, text, text, integer, timestamp with time zone, boolean, uuid[])
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- booking_quote — optional start instant so 365 can be previewed
-- ---------------------------------------------------------------------------
drop function if exists public.booking_quote(uuid, integer, boolean);

create or replace function public.booking_quote(
  p_account uuid,
  p_duration integer,
  p_is_free_trial boolean default false,
  p_start timestamptz default null
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_price int; v_pkg int; v_credit int; v_pkg_used int := 0; v_credit_used int := 0; v_due int;
  v_ent jsonb;
  v_free boolean;
  v_tz text;
  v_local date;
begin
  if auth.uid() is not null and auth.uid() <> p_account and not public.is_admin(auth.uid()) then
    raise exception 'Not authorized';
  end if;
  if p_duration not in (30, 60, 120, 180) then raise exception 'Invalid duration'; end if;

  v_free := coalesce(p_is_free_trial, false) or (
    p_duration = 60 and not public.account_has_used_free_trial(p_account)
  );
  if v_free then
    if p_duration <> 60 then raise exception 'The free trial is 60 minutes only'; end if;
    return jsonb_build_object(
      'session_price_cents', 0, 'is_free_trial', true, 'package_minutes_used', 0,
      'credit_cents_used', 0, 'stripe_cents_due', 0, 'funding', 'free_trial',
      'funding_source', 'free_trial');
  end if;

  if p_duration = 60 and p_start is not null then
    v_tz := public.resolve_account_timezone(p_account);
    begin
      v_local := (p_start at time zone v_tz)::date;
    exception when others then
      v_local := (p_start at time zone 'America/Chicago')::date;
    end;
    v_ent := public.get_study_hall_365_entitlement(p_account, v_local, now(), p_start);
    if coalesce((v_ent->>'entitled')::boolean, false) then
      return jsonb_build_object(
        'session_price_cents', 0, 'is_free_trial', false, 'package_minutes_used', 0,
        'credit_cents_used', 0, 'stripe_cents_due', 0, 'funding', 'study_hall_365',
        'funding_source', 'study_hall_365',
        'reason', v_ent->>'reason');
    end if;
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
    'funding_source', case when v_pkg_used > 0 then 'prepaid' when v_due = 0 then 'credit' else 'payg' end,
    'available_package_minutes', v_pkg, 'available_credit_cents', greatest(v_credit, 0));
end;
$$;

revoke all on function public.booking_quote(uuid, integer, boolean, timestamptz) from public;
grant execute on function public.booking_quote(uuid, integer, boolean, timestamptz)
  to authenticated, service_role;

-- Keep the pre-PR3 3-arg signature so existing RPC callers keep working.
create or replace function public.booking_quote(
  p_account uuid,
  p_duration integer,
  p_is_free_trial boolean
) returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select public.booking_quote(p_account, p_duration, p_is_free_trial, null::timestamptz);
$$;

revoke all on function public.booking_quote(uuid, integer, boolean) from public;
grant execute on function public.booking_quote(uuid, integer, boolean)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Availability: customer Study Hall slots are exactly 60 continuous minutes
-- ---------------------------------------------------------------------------
create or replace function public.get_available_slots(
  p_subject_id uuid, p_duration int, p_from timestamptz, p_to timestamptz, p_slot_minutes int default 30
) returns table (slot_start timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_subject_id is null and p_duration is distinct from 60 then
    raise exception 'Study Hall sessions are 60 minutes';
  end if;

  return query
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
end;
$$;

revoke all on function public.get_available_slots(uuid, int, timestamptz, timestamptz, int) from public;
grant execute on function public.get_available_slots(uuid, int, timestamptz, timestamptz, int)
  to authenticated, service_role;

notify pgrst, 'reload schema';
