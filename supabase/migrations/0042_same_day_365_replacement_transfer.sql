-- =============================================================================
-- 0042 — same-local-day included-benefit transfer on Change (365 + free trial)
-- =============================================================================
-- 0040: an ADDITIONAL same-local-day Study Hall cannot consume 365 twice;
--       the loser falls through to prepaid / credit / PAYG.
-- 0041: persist replaces_booking_id; cancel the old session only after the
--       new booking is confirmed (PAYG waits for Stripe).
--
-- This migration is a separate contract. Changing the ONE 365-covered Study
-- Hall to another time on the SAME account-local date is a replacement, not
-- a second session. book_session must see p_replaces_booking_id BEFORE it
-- chooses prepaid / credit / PAYG, and must not create a Stripe Checkout
-- merely to move that included session.
--
-- CASE A — additional same-day session (no replace id, or replace id is not
--          the booking that owns that day's usage): 0040 fallthrough. Unchanged.
-- CASE B — replace the booking that owns today's usage, same local date:
--          reassociate the single usage row; fund the replacement as
--          study_hall_365; stripe_cents_due = 0; cancel the old row in the
--          same transaction so two confirmed 365 bookings cannot leak.
-- CASE C — replace onto a DIFFERENT local date: do not move the old day's
--          usage. The destination date uses independent 365 entitlement.
--          Ordinary 0041 finalize then cancels the original (365 day stays
--          consumed per existing cancellation policy).
--
-- Free-trial Change has the same shape: the unique live trial row must be
-- cancelled in-transaction before the successor can consume the same benefit.
--
-- 0040/0041 are not rewritten. This file drops the 8-arg book_session and
-- recreates it with an optional 9th argument. Named 8-arg calls still work
-- (the new argument defaults to null).
-- =============================================================================

drop function if exists public.book_session(uuid, uuid, text, text, integer, timestamp with time zone, boolean, uuid[]);
drop function if exists public.book_session(uuid, uuid, text, text, integer, timestamp with time zone, boolean, uuid[], uuid);

create function public.book_session(
  p_student_id uuid,
  p_subject_id uuid,
  p_other_subject text,
  p_request_note text,
  p_duration int,
  p_start timestamptz,
  p_is_free_trial boolean,
  p_student_ids uuid[] default null,
  p_replaces_booking_id uuid default null
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
  v_replace_old public.bookings;
  v_usage_row public.study_hall_365_day_usage;
  v_n int;
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

  -- Lock and verify the session being replaced. Account ownership is required
  -- before any included-benefit transfer. Another household cannot point at
  -- a foreign booking_id and inherit its 365 usage.
  if p_replaces_booking_id is not null then
    select * into v_replace_old
      from public.bookings
     where id = p_replaces_booking_id
     for update;
    if v_replace_old.id is null then
      raise exception 'The current session is no longer scheduled';
    end if;
    if v_replace_old.account_id is distinct from v_account then
      raise exception 'Not authorized to replace this session';
    end if;
    if v_replace_old.status not in ('pending', 'confirmed') then
      raise exception 'The current session is no longer scheduled';
    end if;
    if v_replace_old.subject_id is not null then
      raise exception 'Only Study Hall sessions can be changed.';
    end if;
  end if;

  -- Free-trial Change: cancel the live trial row first so the partial unique
  -- index allows the successor to consume the same one-per-account benefit.
  -- Rollback restores the original if create_booking fails.
  if v_replace_old.id is not null and coalesce(v_replace_old.is_free_trial, false) then
    if p_duration <> 60 then raise exception 'The free trial is 60 minutes only'; end if;
    perform public.restore_booking_value(
      v_replace_old.id, 'replaced — free trial transferred to the new time');
    update public.bookings
       set status = 'cancelled', cancelled_at = coalesce(cancelled_at, now())
     where id = v_replace_old.id
       and status in ('pending', 'confirmed');
    v_booking_id := public.create_booking(
      p_student_id, p_subject_id, p_other_subject, p_request_note, 60, p_start, true, v_ids);
    insert into public.payments (account_id, purpose, booking_id, gross_cents, stripe_paid_cents, credit_applied_cents, status, fulfilled_at)
      values (v_account, 'booking', v_booking_id, 0, 0, 0, 'succeeded', now())
      returning id into v_payment_id;
    update public.bookings
       set funding_source = 'free_trial',
           replaces_booking_id = p_replaces_booking_id
     where id = v_booking_id;
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
    update public.bookings
       set funding_source = 'free_trial',
           replaces_booking_id = coalesce(p_replaces_booking_id, replaces_booking_id)
     where id = v_booking_id;
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

    -- CASE B: the replacement is the same local date as the usage owned by
    -- the booking being replaced. Reassociate that one row. Do not insert a
    -- second usage row. Do not fall through to prepaid / credit / PAYG.
    if p_replaces_booking_id is not null then
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

      if v_sub.id is not null then
        select * into v_usage_row
          from public.study_hall_365_day_usage
         where account_id = v_account
           and local_date = v_local
           and booking_id = p_replaces_booking_id
         for update;
      end if;

      if v_sub.id is not null and v_usage_row.booking_id is not null then
        v_booking_id := public.create_booking(
          p_student_id, p_subject_id, p_other_subject, p_request_note, 60, p_start, false, v_ids);

        update public.study_hall_365_day_usage
           set booking_id = v_booking_id
         where id = v_usage_row.id
           and account_id = v_account
           and local_date = v_local
           and booking_id = p_replaces_booking_id;
        get diagnostics v_n = row_count;

        if v_n = 1 then
          insert into public.payments (account_id, purpose, booking_id, gross_cents, stripe_paid_cents, credit_applied_cents, status, fulfilled_at)
            values (v_account, 'booking', v_booking_id, 0, 0, 0, 'succeeded', now())
            returning id into v_payment_id;
          update public.bookings
             set status = 'confirmed',
                 payment_status = 'paid',
                 payment_hold_expires_at = null,
                 price_cents = 0,
                 funding_source = 'study_hall_365',
                 replaces_booking_id = p_replaces_booking_id
           where id = v_booking_id;
          perform public.restore_booking_value(
            v_replace_old.id, 'replaced — Study Hall 365 transferred to the new time');
          update public.bookings
             set status = 'cancelled', cancelled_at = coalesce(cancelled_at, now())
           where id = v_replace_old.id
             and status in ('pending', 'confirmed');
          if current_setting('studyhall.debug_fail_after_funding', true) = '1' then
            raise exception 'debug_fail_after_funding';
          end if;
          return jsonb_build_object(
            'booking_id', v_booking_id, 'payment_id', v_payment_id, 'funding', 'study_hall_365',
            'funding_source', 'study_hall_365',
            'session_price_cents', 0, 'package_minutes_used', 0, 'credit_cents_used', 0,
            'stripe_cents_due', 0, 'booking_status', 'confirmed');
        end if;
        -- Usage row moved under us. Keep this booking and fund it below.
      end if;
    end if;

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
        if v_booking_id is null then
          v_booking_id := public.create_booking(
            p_student_id, p_subject_id, p_other_subject, p_request_note, 60, p_start, false, v_ids);
        end if;

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
                 funding_source = 'study_hall_365',
                 replaces_booking_id = coalesce(p_replaces_booking_id, replaces_booking_id)
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
    update public.bookings
       set funding_source = 'request',
           replaces_booking_id = coalesce(p_replaces_booking_id, replaces_booking_id)
     where id = v_booking_id;
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
       set status = 'confirmed', payment_status = 'paid', payment_hold_expires_at = null, funding_source = 'prepaid',
           replaces_booking_id = coalesce(p_replaces_booking_id, replaces_booking_id)
     where id = v_booking_id;
    v_status := 'confirmed';

  elsif v_funding = 'credit' then
    insert into public.payments (account_id, purpose, booking_id, gross_cents, stripe_paid_cents, credit_applied_cents, status, fulfilled_at)
      values (v_account, 'booking', v_booking_id, v_price, 0, v_credit_used, 'succeeded', now())
      returning id into v_payment_id;
    insert into public.dollar_credit_ledger (account_id, amount_cents, entry_type, payment_id, booking_id, reason, reference, created_by)
      values (v_account, -v_credit_used, 'consumption', v_payment_id, v_booking_id, 'booking paid with account credit', 'book:' || v_booking_id::text || ':credit', v_caller);
    update public.bookings
       set status = 'confirmed', payment_status = 'paid', payment_hold_expires_at = null, funding_source = 'credit',
           replaces_booking_id = coalesce(p_replaces_booking_id, replaces_booking_id)
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
    update public.bookings
       set funding_source = 'payg',
           replaces_booking_id = coalesce(p_replaces_booking_id, replaces_booking_id)
     where id = v_booking_id;
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

-- attach_booking_replacement: if book_session already linked and cancelled the
-- original (same-day 365 / free-trial transfer), treat that as attached.
create or replace function public.attach_booking_replacement(
  p_new_booking uuid,
  p_old_booking uuid
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_caller uuid := auth.uid();
  v_new public.bookings;
  v_old public.bookings;
begin
  if p_new_booking is null or p_old_booking is null then
    raise exception 'Replacement bookings are required';
  end if;
  if p_new_booking = p_old_booking then
    raise exception 'A session cannot replace itself';
  end if;

  select * into v_new from public.bookings where id = p_new_booking for update;
  select * into v_old from public.bookings where id = p_old_booking for update;

  if v_new.id is null or v_old.id is null then
    raise exception 'Booking not found';
  end if;
  if v_new.account_id is distinct from v_old.account_id then
    raise exception 'Not authorized to replace this session';
  end if;
  if v_caller is not null and v_caller is distinct from v_new.account_id and not public.is_admin(v_caller) then
    raise exception 'Not authorized';
  end if;

  if v_new.replaces_booking_id is not null then
    if v_new.replaces_booking_id is not distinct from p_old_booking then
      return jsonb_build_object(
        'status', 'attached',
        'booking_id', p_new_booking,
        'replaces_booking_id', p_old_booking
      );
    end if;
    raise exception 'This session already replaces a different booking';
  end if;

  if v_old.status not in ('pending', 'confirmed') then
    raise exception 'The current session is no longer scheduled';
  end if;
  if v_new.status not in ('pending', 'confirmed') then
    raise exception 'The new session is not awaiting confirmation';
  end if;

  update public.bookings
     set replaces_booking_id = p_old_booking
   where id = p_new_booking;

  return jsonb_build_object(
    'status', 'attached',
    'booking_id', p_new_booking,
    'replaces_booking_id', p_old_booking
  );
end;
$$;

revoke all on function public.book_session(uuid, uuid, text, text, integer, timestamp with time zone, boolean, uuid[], uuid) from public;
revoke all on function public.book_session(uuid, uuid, text, text, integer, timestamp with time zone, boolean, uuid[], uuid) from anon;
grant execute on function public.book_session(uuid, uuid, text, text, integer, timestamp with time zone, boolean, uuid[], uuid)
  to authenticated, service_role;

revoke all on function public.attach_booking_replacement(uuid, uuid) from public;
revoke all on function public.attach_booking_replacement(uuid, uuid) from anon;
grant execute on function public.attach_booking_replacement(uuid, uuid) to authenticated, service_role;

notify pgrst, 'reload schema';
