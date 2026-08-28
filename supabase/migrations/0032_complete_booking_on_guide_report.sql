-- =============================================================================
-- End-of-session completion — Guide report is the normal completion path.
--
-- Why this exists:
--   0030 allowed a report on confirmed bookings after scheduled_end, but did
--   not complete the booking or create earnings. 0031 (household) rewrote both
--   report RPCs and required status = 'completed' again. The only writer of
--   that status on the happy path was admin_complete_booking. Guides were sent
--   to Finish report after scheduled_end while the booking was still confirmed,
--   so a legitimate report could fail until Management marked complete.
--
-- Correction (pattern A):
--   A trusted report RPC, after scheduled_end, atomically completes the
--   confirmed booking and records the Guide earning once. Management stays
--   the exception layer (Mark complete, no-show, release, dispute).
--
-- Earnings: rate × duration, one row per booking (ON CONFLICT DO NOTHING).
-- Recording, Daily, cancel/refund, and portal UX are unchanged.
-- =============================================================================

create or replace function public.complete_ended_confirmed_booking(p_booking uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bk record;
begin
  select id, status, scheduled_end
    into v_bk
    from public.bookings
   where id = p_booking
   for update;

  if v_bk.id is null then
    raise exception 'Booking not found';
  end if;

  if v_bk.status = 'completed' then
    return;
  end if;

  if v_bk.status = 'confirmed'
     and v_bk.scheduled_end is not null
     and v_bk.scheduled_end <= now() then
    update public.bookings
       set status = 'completed',
           completed_at = coalesce(completed_at, now())
     where id = p_booking
       and status = 'confirmed';
    perform public.try_full_earning(
      p_booking,
      'session completed via Guide report — full tutor compensation'
    );
    return;
  end if;

  raise exception 'Reports can only be submitted for completed Study Hall sessions';
end;
$$;

revoke all on function public.complete_ended_confirmed_booking(uuid) from public;
revoke all on function public.complete_ended_confirmed_booking(uuid) from anon, authenticated;
grant execute on function public.complete_ended_confirmed_booking(uuid) to service_role;

comment on function public.complete_ended_confirmed_booking(uuid) is
  'Internal: complete a confirmed booking after scheduled_end and record one earning. No-op if already completed. Not a Guide-callable action.';

-- ---------------------------------------------------------------------------
-- One-child report: same fields / household child section as 0031.
-- Timing + completion now go through complete_ended_confirmed_booking.
-- ---------------------------------------------------------------------------
create or replace function public.submit_session_report(
  p_booking uuid,
  p_focus text,
  p_work_summary text,
  p_redirection text,
  p_guide_note text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_bk record;
  v_id uuid;
  v_work text := btrim(coalesce(p_work_summary, ''));
  v_note text := nullif(btrim(coalesce(p_guide_note, '')), '');
  v_child uuid;
  v_child_name text;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  select id, tutor_id, account_id, student_id, student_first_name
    into v_bk
    from public.bookings
   where id = p_booking;

  if v_bk.id is null then raise exception 'Booking not found'; end if;
  if v_bk.tutor_id is null then raise exception 'This booking has no assigned Guide'; end if;
  if v_uid is distinct from v_bk.tutor_id and not public.is_admin(v_uid) then
    raise exception 'Not authorized';
  end if;
  if p_focus is null or p_focus not in (
    'great_focus', 'good_focus', 'needed_redirection', 'difficult_session'
  ) then
    raise exception 'A valid focus rating is required';
  end if;
  if p_redirection is null or p_redirection not in ('none', 'a_little', 'several_times') then
    raise exception 'A valid redirection level is required';
  end if;
  if char_length(v_work) < 1 or char_length(v_work) > 280 then
    raise exception 'What they worked on is required (1–280 characters)';
  end if;
  if v_note is not null and char_length(v_note) > 280 then
    raise exception 'Guide note must be at most 280 characters';
  end if;

  perform public.complete_ended_confirmed_booking(p_booking);

  begin
    insert into public.session_reports (
      booking_id, tutor_id, account_id,
      focus_rating, work_summary, redirection_level, guide_note
    ) values (
      p_booking, v_bk.tutor_id, v_bk.account_id,
      p_focus, v_work, p_redirection, v_note
    )
    returning id into v_id;
  exception when unique_violation then
    raise exception 'A report has already been submitted for this session';
  end;

  select bc.student_id, coalesce(nullif(split_part(s.full_name, ' ', 1), ''), v_bk.student_first_name, 'Child')
    into v_child, v_child_name
    from public.booking_children bc
    join public.students s on s.id = bc.student_id
   where bc.booking_id = p_booking
   order by bc.sort_order
   limit 1;

  if v_child is null then
    v_child := v_bk.student_id;
    v_child_name := coalesce(v_bk.student_first_name, 'Child');
  end if;

  insert into public.session_report_children (
    report_id, booking_id, student_id, student_first_name,
    focus_rating, work_summary, redirection_level, guide_note
  ) values (
    v_id, p_booking, v_child, v_child_name,
    p_focus, v_work, p_redirection, v_note
  );

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Household report: one header + one section per child. Same completion helper.
-- ---------------------------------------------------------------------------
create or replace function public.submit_household_session_report(
  p_booking uuid,
  p_child_reports jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_bk record;
  v_id uuid;
  v_row jsonb;
  v_sid uuid;
  v_focus text;
  v_work text;
  v_redirection text;
  v_note text;
  v_name text;
  v_expected int;
  v_got int := 0;
  v_first jsonb;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  select id, tutor_id, account_id, student_id, student_first_name, child_count
    into v_bk
    from public.bookings
   where id = p_booking;

  if v_bk.id is null then raise exception 'Booking not found'; end if;
  if v_bk.tutor_id is null then raise exception 'This booking has no assigned Guide'; end if;
  if v_uid is distinct from v_bk.tutor_id and not public.is_admin(v_uid) then
    raise exception 'Not authorized';
  end if;
  if p_child_reports is null or jsonb_typeof(p_child_reports) <> 'array' then
    raise exception 'A report is required for each child';
  end if;

  select count(*) into v_expected from public.booking_children where booking_id = p_booking;
  if v_expected < 1 then v_expected := 1; end if;
  if jsonb_array_length(p_child_reports) <> v_expected then
    raise exception 'A report is required for each child';
  end if;

  for v_row in select value from jsonb_array_elements(p_child_reports)
  loop
    v_focus := v_row ->> 'focus';
    v_work := btrim(coalesce(v_row ->> 'work_summary', ''));
    v_redirection := v_row ->> 'redirection';
    v_note := nullif(btrim(coalesce(v_row ->> 'guide_note', '')), '');
    if v_focus is null or v_focus not in (
      'great_focus', 'good_focus', 'needed_redirection', 'difficult_session'
    ) then
      raise exception 'A valid focus rating is required';
    end if;
    if v_redirection is null or v_redirection not in ('none', 'a_little', 'several_times') then
      raise exception 'A valid redirection level is required';
    end if;
    if char_length(v_work) < 1 or char_length(v_work) > 280 then
      raise exception 'What they worked on is required (1–280 characters)';
    end if;
    if v_note is not null and char_length(v_note) > 280 then
      raise exception 'Guide note must be at most 280 characters';
    end if;
  end loop;

  perform public.complete_ended_confirmed_booking(p_booking);

  v_first := p_child_reports -> 0;

  begin
    insert into public.session_reports (
      booking_id, tutor_id, account_id,
      focus_rating, work_summary, redirection_level, guide_note
    ) values (
      p_booking, v_bk.tutor_id, v_bk.account_id,
      v_first ->> 'focus',
      btrim(coalesce(v_first ->> 'work_summary', '')),
      v_first ->> 'redirection',
      nullif(btrim(coalesce(v_first ->> 'guide_note', '')), '')
    )
    returning id into v_id;
  exception when unique_violation then
    raise exception 'A report has already been submitted for this session';
  end;

  for v_row in select value from jsonb_array_elements(p_child_reports)
  loop
    v_sid := nullif(v_row ->> 'student_id', '')::uuid;
    v_focus := v_row ->> 'focus';
    v_work := btrim(coalesce(v_row ->> 'work_summary', ''));
    v_redirection := v_row ->> 'redirection';
    v_note := nullif(btrim(coalesce(v_row ->> 'guide_note', '')), '');

    if v_sid is null or not exists (
      select 1 from public.booking_children bc
       where bc.booking_id = p_booking and bc.student_id = v_sid
    ) then
      if v_sid is distinct from v_bk.student_id then
        raise exception 'Not authorized';
      end if;
    end if;

    select split_part(full_name, ' ', 1) into v_name from public.students where id = v_sid;
    insert into public.session_report_children (
      report_id, booking_id, student_id, student_first_name,
      focus_rating, work_summary, redirection_level, guide_note
    ) values (
      v_id, p_booking, coalesce(v_sid, v_bk.student_id), coalesce(nullif(v_name, ''), 'Child'),
      v_focus, v_work, v_redirection, v_note
    );
    v_got := v_got + 1;
  end loop;

  return v_id;
end;
$$;

comment on function public.submit_session_report(uuid, text, text, text, text) is
  'Guide post-session report. Allowed when booking is completed, or confirmed after scheduled_end. Completes the booking and records one earning.';

comment on function public.submit_household_session_report(uuid, jsonb) is
  'Household Guide report. Same completion + earning rules as submit_session_report. One earning for the booking.';

notify pgrst, 'reload schema';
