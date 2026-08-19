-- =============================================================================
-- African Tutors — Phase 5A: live tutoring-session room foundation (Daily)
-- =============================================================================
-- The African Tutors booking remains the source of truth. This migration adds:
--   * authorize_session_join(booking) — server-side authorization + join window
--     decision (10 min before start .. 15 min after end), using server time.
--   * session_presence — minimal per-booking attendance (student/tutor joined &
--     left timestamps) for future recording / tutor-quality work. NOT a financial
--     completion signal; Phase 4 earnings logic is untouched.
--   * bookings.daily_room_name — opaque, PII-free room id recorded on first join.
-- No Daily secrets live here; realtime media is Daily's responsibility. Idempotent.
-- =============================================================================

alter table public.bookings add column if not exists daily_room_name text;

-- ---------------------------------------------------------------------------
-- session_presence — one row per booking; who joined/left and when.
-- ---------------------------------------------------------------------------
create table if not exists public.session_presence (
  booking_id              uuid primary key references public.bookings (id) on delete cascade,
  student_first_joined_at timestamptz,
  student_last_seen_at    timestamptz,
  student_last_left_at    timestamptz,
  tutor_first_joined_at   timestamptz,
  tutor_last_seen_at      timestamptz,
  tutor_last_left_at      timestamptz,
  updated_at              timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- authorize_session_join — the authoritative gate for room access. SECURITY
-- DEFINER so it can read the booking, but it performs its OWN authorization and
-- reveals nothing to non-parties (returns only {authorized:false}). Join window
-- and eligibility use server time. Room name is opaque (no PII).
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
    v_open := v_bk.scheduled_start - interval '10 minutes';
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
    when v_role = 'tutor' then coalesce(nullif(split_part(coalesce(v_bk.tutor_display_name, ''), ' ', 1), ''), 'Tutor')
    else 'Admin' end;
  v_counter := case
    when v_role = 'student' then coalesce(nullif(split_part(coalesce(v_bk.tutor_display_name, ''), ' ', 1), ''), 'Your tutor')
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

-- ---------------------------------------------------------------------------
-- record_session_presence — write attendance timestamps. Admin/service only
-- (is_financial_actor) so a client can never forge presence. Idempotent:
-- first_joined_at is set once; last_seen/last_left advance.
-- ---------------------------------------------------------------------------
create or replace function public.record_session_presence(p_booking uuid, p_role text, p_event text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_financial_actor() then raise exception 'Not authorized'; end if;
  if p_role not in ('student', 'tutor') then raise exception 'invalid role'; end if;
  if p_event not in ('join', 'leave') then raise exception 'invalid event'; end if;

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

-- ---------------------------------------------------------------------------
-- RLS: presence is readable by the booking's parties + admin; never client-writable.
-- ---------------------------------------------------------------------------
alter table public.session_presence enable row level security;
drop policy if exists session_presence_select on public.session_presence;
create policy session_presence_select on public.session_presence for select to authenticated
  using (
    exists (select 1 from public.bookings b where b.id = booking_id and (b.account_id = auth.uid() or b.tutor_id = auth.uid()))
    or public.is_admin(auth.uid())
  );
grant select on public.session_presence to authenticated;
grant all on public.session_presence to service_role;

do $$
declare fn text;
begin
  for fn in select unnest(array[
    'authorize_session_join(uuid)',
    'record_session_presence(uuid,text,text)'
  ]) loop
    execute format('revoke all on function public.%s from public', fn);
    execute format('grant execute on function public.%s to authenticated, service_role', fn);
  end loop;
end $$;

notify pgrst, 'reload schema';
