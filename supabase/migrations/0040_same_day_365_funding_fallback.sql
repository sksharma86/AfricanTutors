-- =============================================================================
-- 0040 — same-day Study Hall 365 consume loss falls through to prepaid/credit/PAYG
-- =============================================================================
-- Narrow, additive. Does not rewrite historical bookings or usage rows.
-- Does not add a weekly planner or a second funding engine.
-- Does not change the one-included-Study-Hall-per-local-day rule.
--
-- Root cause (0038 book_session):
--   1. get_study_hall_365_entitlement may report entitled=true (no usage yet).
--   2. create_booking runs.
--   3. insert into study_hall_365_day_usage ON CONFLICT DO NOTHING.
--   4. If the unique (account_id, local_date) insert loses, the function RAISES
--      'This day is already included with Study Hall 365' and aborts.
-- Sequential second bookings after a committed usage row already skip 365
-- (entitled=false, reason=already_consumed) and fall through. Concurrent
-- same-local-day attempts both see entitled=true; the loser was treated as
-- terminal instead of continuing the existing funding hierarchy.
--
-- Fix: lock the entitled membership BEFORE create_booking, re-read usage under
-- that lock, and if consume loses, keep the booking (if already created) and
-- fund it with prepaid / credit / PAYG. Unique (account_id, local_date) remains
-- the one-per-day 365 authority. No second 365-covered session for that day.
--
-- Function privileges are set explicitly (revoke public/anon; grant execute to
-- authenticated + service_role) so we do not rely on default grants.
-- =============================================================================

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
  v_consumed_id uuid;
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

  -- Study Hall 365: lock membership, then consume one local day. A lost consume
  -- is not terminal — prepaid / credit / PAYG continue below.
  if p_subject_id is null and p_start is not null then
    v_tz := public.resolve_account_timezone(v_account);
    begin
      v_local := (p_start at time zone v_tz)::date;
    exception when others then
      v_local := (p_start at time zone 'America/Chicago')::date;
    end;
    v_ent := public.get_study_hall_365_entitlement(v_account, v_local, now(), p_start);
    if coalesce((v_ent->>'entitled')::boolean, false) then
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

      v_consumed_id := null;
      if v_sub.id is not null then
        select id into v_consumed_id
          from public.study_hall_365_day_usage
         where account_id = v_account and local_date = v_local;
      end if;

      if v_sub.id is not null and v_consumed_id is null then
        v_booking_id := public.create_booking(
          p_student_id, p_subject_id, p_other_subject, p_request_note, 60, p_start, false, v_ids);

        insert into public.study_hall_365_day_usage (
          account_id, subscription_id, local_date, time_zone, booking_id
        ) values (
          v_account, v_sub.id, v_local, v_tz, v_booking_id
        )
        on conflict (account_id, local_date) do nothing
        returning id into v_usage;

        if v_usage is not null then
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
        -- Unique day lost after create_booking. Keep this booking and fund it
        -- with prepaid / credit / PAYG. Do not raise; do not consume 365.
      end if;
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

  if v_booking_id is null then
    v_booking_id := public.create_booking(
      p_student_id, p_subject_id, p_other_subject, p_request_note, p_duration, p_start, false, v_ids);
  end if;

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
revoke all on function public.book_session(uuid, uuid, text, text, integer, timestamp with time zone, boolean, uuid[]) from anon;
grant execute on function public.book_session(uuid, uuid, text, text, integer, timestamp with time zone, boolean, uuid[])
  to authenticated, service_role;

notify pgrst, 'reload schema';
