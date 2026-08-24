-- Study Hall PR2: new customer pricing model (forward-only).
--
-- Session list prices (NEW purchases only):
--   30 minutes → $12 (1200¢)  — retained for free-trial + existing paid-30 support
--   60 minutes → $12 (1200¢)  — primary pay-as-you-go retail rate ($12/hour)
--
-- Package catalog (NEW purchases only):
--   14 Hour Routine → 840 minutes → $140 (14000¢)  — MOST POPULAR
--   28 Hour Routine → 1680 minutes → $252 (25200¢) — BEST VALUE
--
-- Historical safety:
--   * Old pkg_10h / pkg_20h / pkg_40h rows are DEACTIVATED (is_active=false), not deleted.
--   * Existing package_minute_ledger / dollar_credit_ledger / payments / bookings are untouched.
--   * Free-trial rules (30 min, $0, one per account) are unchanged.
--   * Guide compensation / Stripe Connect / subscriptions / Auto Refill are unchanged.
--
-- Apply this migration to production AFTER merge (do not run from the agent).

-- ---------------------------------------------------------------------------
-- Single authoritative session list-price helper (cents).
-- ---------------------------------------------------------------------------
create or replace function public.session_list_price_cents(p_duration integer)
returns integer
language plpgsql
immutable
as $$
begin
  if p_duration not in (30, 60) then
    raise exception 'Invalid duration';
  end if;
  -- Both durations list at $12. Free-trial path never calls this (price forced to 0).
  return 1200;
end;
$$;

revoke all on function public.session_list_price_cents(integer) from public;
grant execute on function public.session_list_price_cents(integer) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Re-declare quote / book / create with the shared list-price helper.
-- Bodies otherwise match the latest prior definitions (0007 / 0008 / 0019).
-- ---------------------------------------------------------------------------
create or replace function public.booking_quote(
  p_account uuid, p_duration integer, p_is_free_trial boolean default false
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_price int; v_pkg int; v_credit int; v_pkg_used int; v_credit_used int; v_due int;
begin
  if auth.uid() is not null and auth.uid() <> p_account and not public.is_admin(auth.uid()) then
    raise exception 'Not authorized';
  end if;
  if p_duration not in (30, 60) then raise exception 'Invalid duration'; end if;

  if p_is_free_trial then
    return jsonb_build_object(
      'session_price_cents', 0, 'is_free_trial', true,
      'package_minutes_used', 0, 'credit_cents_used', 0, 'stripe_cents_due', 0,
      'funding', 'free_trial');
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

  if p_duration not in (30, 60) then raise exception 'Invalid duration'; end if;

  if p_is_free_trial then
    if p_duration <> 30 then raise exception 'The free trial is 30 minutes only'; end if;
    v_booking_id := public.create_booking(
      p_student_id, p_subject_id, p_other_subject, p_request_note, 30, p_start, true);
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

  if p_subject_id is null then
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
    v_price := public.session_list_price_cents(p_duration);
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


-- ---------------------------------------------------------------------------
-- Package catalog: deactivate historical 10/20/40h SKUs; add 14h / 28h.
-- ---------------------------------------------------------------------------
update public.package_products
set is_active = false,
    updated_at = now()
where code in ('pkg_10h', 'pkg_20h', 'pkg_40h')
  and is_active = true;

insert into public.package_products (code, name, minutes, price_cents, is_active, sort_order)
values
  ('pkg_14h', '14 Hour Routine', 840, 14000, true, 1),
  ('pkg_28h', '28 Hour Routine', 1680, 25200, true, 2)
on conflict (code) do update
set name = excluded.name,
    minutes = excluded.minutes,
    price_cents = excluded.price_cents,
    is_active = true,
    sort_order = excluded.sort_order,
    updated_at = now();
