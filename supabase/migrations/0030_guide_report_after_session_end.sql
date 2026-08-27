-- =============================================================================
-- Guide workstation — allow post-session reports after the scheduled end
-- without waiting for admin completion.
--
-- Earnings, Daily, matching, and admin completion are unchanged.
-- Cancelled / no-show / expired bookings still cannot take a completion report.
-- Future confirmed bookings remain rejected (same error string as 0023).
-- =============================================================================

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
  v_ended boolean := false;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select id, tutor_id, account_id, status, scheduled_end
    into v_bk
    from public.bookings
   where id = p_booking;

  if v_bk.id is null then
    raise exception 'Booking not found';
  end if;

  if v_bk.tutor_id is null then
    raise exception 'This booking has no assigned Guide';
  end if;

  if v_uid is distinct from v_bk.tutor_id and not public.is_admin(v_uid) then
    raise exception 'Not authorized';
  end if;

  v_ended := v_bk.scheduled_end is not null and v_bk.scheduled_end <= now();

  if v_bk.status = 'completed' then
    null;
  elsif v_bk.status = 'confirmed' and v_ended then
    null;
  else
    raise exception 'Reports can only be submitted for completed Study Hall sessions';
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

  return v_id;
end;
$$;

comment on function public.submit_session_report(uuid, text, text, text, text) is
  'Guide post-session report. Allowed when booking is completed, or confirmed after scheduled_end. Does not create earnings.';
