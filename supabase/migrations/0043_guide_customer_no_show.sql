-- =============================================================================
-- 0043_guide_customer_no_show.sql
-- PR6 — Guide customer no-show (T+15) + presence race guard
-- =============================================================================
-- Reuses existing bookings.status = no_show (customer no-show).
-- Reuses try_full_earning (full Guide pay, one row per booking).
-- Does NOT call restore_booking_value (365 / prepaid / credit / trial / PAYG stay consumed).
-- Does NOT add a new booking status.
--
-- Presence source of truth: session_presence.student_first_joined_at, written by
-- the HTTP join path (finalize_http_session_join). Daily participant lists are
-- not consulted server-side.
--
-- HTTP join vs Guide no-show race:
--   finalize_http_session_join FOR UPDATE on the booking, then writes presence.
--   guide_mark_customer_no_show FOR UPDATE on the same booking, then reads presence.
--   Those two serialize. Outcome is A (presence wins, no-show rejected) or
--   B (no-show wins, HTTP join raises, joinSession must not return a Daily token).
--   record_session_presence stays a silent no-op after finalization so Daily
--   webhooks cannot restore attendance.
--   Already-issued tokens from an earlier successful join imply presence already
--   exists (A). This migration does not revoke Daily tokens.
-- =============================================================================

create or replace function public.record_session_presence(p_booking uuid, p_role text, p_event text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_status public.booking_status;
begin
  if not public.is_financial_actor() then raise exception 'Not authorized'; end if;
  if p_role not in ('student', 'tutor') then raise exception 'invalid role'; end if;
  if p_event not in ('join', 'leave') then raise exception 'invalid event'; end if;

  if p_event = 'join' then
    select status into v_status from public.bookings where id = p_booking;
    if v_status is null or v_status not in ('pending', 'confirmed') then
      return;
    end if;
  end if;

  insert into public.session_presence (booking_id) values (p_booking) on conflict (booking_id) do nothing;

  if p_event = 'join' then
    update public.session_presence set
      student_first_joined_at = case when p_role = 'student' then coalesce(student_first_joined_at, now()) else student_first_joined_at end,
      student_last_seen_at    = case when p_role = 'student' then now() else student_last_seen_at end,
      tutor_first_joined_at   = case when p_role = 'tutor' then coalesce(tutor_first_joined_at, now()) else tutor_first_joined_at end,
      tutor_last_seen_at      = case when p_role = 'tutor' then now() else tutor_last_seen_at end,
      updated_at = now()
    where booking_id = p_booking;
  else
    update public.session_presence set
      student_last_left_at = case when p_role = 'student' then now() else student_last_left_at end,
      tutor_last_left_at   = case when p_role = 'tutor' then now() else tutor_last_left_at end,
      updated_at = now()
    where booking_id = p_booking;
  end if;
end;
$$;

revoke all on function public.record_session_presence(uuid, text, text) from public;
revoke all on function public.record_session_presence(uuid, text, text) from anon;
grant execute on function public.record_session_presence(uuid, text, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- finalize_http_session_join — HTTP join only, after Daily mint, before token
-- is returned. Locks the booking. Fails (does not no-op) when the Study Hall
-- is no longer joinable so joinSession can withhold the token.
-- Webhooks must keep using record_session_presence.
-- ---------------------------------------------------------------------------
create or replace function public.finalize_http_session_join(p_booking uuid, p_role text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bk record;
begin
  if not public.is_financial_actor() then
    raise exception 'Not authorized';
  end if;
  if p_role not in ('student', 'tutor') then
    raise exception 'invalid role';
  end if;

  select id, status, payment_status
    into v_bk
    from public.bookings
   where id = p_booking
     for update;

  if v_bk.id is null then
    raise exception 'This Study Hall is not joinable';
  end if;

  if v_bk.payment_status is not distinct from 'awaiting_payment' then
    raise exception 'This Study Hall is not joinable';
  end if;

  if v_bk.status is distinct from 'confirmed' then
    raise exception 'This Study Hall is not joinable';
  end if;

  insert into public.session_presence (booking_id)
  values (p_booking)
  on conflict (booking_id) do nothing;

  if p_role = 'student' then
    update public.session_presence set
      student_first_joined_at = coalesce(student_first_joined_at, now()),
      student_last_seen_at = now(),
      updated_at = now()
    where booking_id = p_booking;
  else
    update public.session_presence set
      tutor_first_joined_at = coalesce(tutor_first_joined_at, now()),
      tutor_last_seen_at = now(),
      updated_at = now()
    where booking_id = p_booking;
  end if;

  return jsonb_build_object('ok', true, 'status', v_bk.status::text, 'role', p_role);
end;
$$;

revoke all on function public.finalize_http_session_join(uuid, text) from public;
revoke all on function public.finalize_http_session_join(uuid, text) from anon;
grant execute on function public.finalize_http_session_join(uuid, text) to authenticated, service_role;

comment on function public.finalize_http_session_join(uuid, text) is
  'PR6: HTTP join finalization. Locks the booking, records student/Guide presence, fails if no longer joinable. Does not revoke Daily tokens. Webhooks must not call this.';

-- ---------------------------------------------------------------------------
-- guide_mark_customer_no_show — assigned Guide (or admin) after T+15.
-- Server time (now()) is authoritative. FOR UPDATE on the booking row.
-- ---------------------------------------------------------------------------
create or replace function public.guide_mark_customer_no_show(p_booking uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_bk record;
  v_student_joined timestamptz;
  v_call_attempted boolean := false;
  v_call_status text := null;
begin
  if v_uid is null then
    raise exception 'Not authorized';
  end if;

  select id, tutor_id, status, scheduled_start, payment_status
    into v_bk
    from public.bookings
   where id = p_booking
     for update;

  if v_bk.id is null then
    raise exception 'Booking not found';
  end if;

  if v_bk.tutor_id is null or (v_bk.tutor_id is distinct from v_uid and not public.is_admin(v_uid)) then
    raise exception 'Not authorized';
  end if;

  if v_bk.status = 'no_show' then
    return jsonb_build_object(
      'status', 'no_show',
      'idempotent', true,
      'booking_status', 'no_show',
      'guide_paid', true,
      'funding_restored', false
    );
  end if;

  if v_bk.payment_status is not distinct from 'awaiting_payment' then
    raise exception 'This Study Hall is awaiting payment';
  end if;

  if v_bk.status = 'cancelled' then
    raise exception 'This Study Hall was cancelled';
  end if;
  if v_bk.status = 'completed' then
    raise exception 'This Study Hall is already completed';
  end if;
  if v_bk.status is distinct from 'confirmed' then
    raise exception 'This Study Hall is not eligible';
  end if;

  if v_bk.scheduled_start is null then
    raise exception 'This Study Hall is not scheduled';
  end if;

  if now() < v_bk.scheduled_start + interval '15 minutes' then
    raise exception 'Customer no-show can be marked 15 minutes after the scheduled start';
  end if;

  insert into public.session_presence (booking_id)
  values (p_booking)
  on conflict (booking_id) do nothing;

  select student_first_joined_at
    into v_student_joined
    from public.session_presence
   where booking_id = p_booking
     for update;

  if v_student_joined is not null then
    raise exception 'The child has already joined this Study Hall';
  end if;

  update public.bookings
     set status = 'no_show'
   where id = p_booking
     and status = 'confirmed';

  if not found then
    raise exception 'This Study Hall is not eligible';
  end if;

  perform public.try_full_earning(p_booking, 'customer no-show — full tutor compensation');

  if to_regclass('public.parent_escalation_requests') is not null then
    select true, e.status
      into v_call_attempted, v_call_status
      from public.parent_escalation_requests e
     where e.booking_id = p_booking
     order by e.created_at desc
     limit 1;
    v_call_attempted := coalesce(v_call_attempted, false);
  end if;

  perform public.log_admin_action(
    'guide_customer_no_show',
    'bookings',
    p_booking,
    jsonb_build_object('status', 'confirmed', 'guide_id', v_uid),
    jsonb_build_object(
      'status', 'no_show',
      'guide_id', v_uid,
      'waited_until', now(),
      'student_joined', false,
      'call_parent_attempted', v_call_attempted,
      'call_parent_status', v_call_status
    ),
    'customer no-show — Guide waited through required window; full Guide pay; customer funding consumed'
  );

  return jsonb_build_object(
    'status', 'no_show',
    'idempotent', false,
    'booking_status', 'no_show',
    'guide_paid', true,
    'funding_restored', false,
    'call_parent_attempted', v_call_attempted,
    'call_parent_status', v_call_status
  );
end;
$$;

revoke all on function public.guide_mark_customer_no_show(uuid) from public;
revoke all on function public.guide_mark_customer_no_show(uuid) from anon;
grant execute on function public.guide_mark_customer_no_show(uuid) to authenticated, service_role;

comment on function public.guide_mark_customer_no_show(uuid) is
  'PR6: assigned Guide marks customer no-show after T+15 using server time. Full Guide pay once. No customer funding restore. No session report.';

notify pgrst, 'reload schema';
