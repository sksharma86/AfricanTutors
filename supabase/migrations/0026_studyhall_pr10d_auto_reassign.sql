-- =============================================================================
-- Study Hall at Home — PR10D amendment: availability-aware Guide reassignment
-- =============================================================================
-- Goals:
--   * Manual reassignment candidates must be continuously available for the
--     ENTIRE booked interval (tutor_is_available), with no booking overlap,
--     excluding the current Guide. Subject expertise is irrelevant.
--   * When a Guide cancels / becomes unavailable, try automatic reassignment
--     using the same eligibility rules + exclusion_violation retry (mirrors
--     book_session concurrency safety). bookings_no_tutor_overlap stays intact.
--   * Success resolves open cancellation requests; failure leaves them open for
--     manager coverage handling (no silent "resolved" pretend).
-- Idempotent. Do not apply from product deploys until reviewed.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- list_reassignment_candidates — admin-facing eligible Guide list for a booking.
-- Eligibility: approved + role=tutor + timezone set + continuously available for
-- the full [scheduled_start, scheduled_end] via tutor_is_available + not current
-- Guide. Subject expertise is NOT considered.
-- ---------------------------------------------------------------------------
drop function if exists public.list_reassignment_candidates(uuid);

create or replace function public.list_reassignment_candidates(p_booking uuid)
returns table (
  candidate_tutor_id uuid,
  display_name text,
  upcoming_load bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_bk record;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Not authorized';
  end if;

  select id, tutor_id, scheduled_start, scheduled_end, status
    into v_bk
    from public.bookings
   where id = p_booking;

  if v_bk.id is null then
    raise exception 'Booking not found';
  end if;
  if v_bk.scheduled_start is null or v_bk.scheduled_end is null then
    raise exception 'Only scheduled bookings can be reassigned';
  end if;
  if v_bk.status not in ('pending', 'confirmed') then
    raise exception 'Cannot reassign a % booking', v_bk.status;
  end if;

  return query
  select
    tp.profile_id,
    pr.display_name,
    (
      select count(*)::bigint
      from public.bookings b3
      where b3.tutor_id = tp.profile_id
        and b3.status in ('pending', 'confirmed')
        and b3.scheduled_start >= now()
    )
  from public.tutor_profiles tp
  join public.profiles pr on pr.id = tp.profile_id
  where tp.status = 'approved'
    and pr.role = 'tutor'
    and coalesce(btrim(tp.timezone), '') <> ''
    and tp.profile_id is distinct from v_bk.tutor_id
    and public.tutor_is_available(
      tp.profile_id,
      coalesce(tp.timezone, 'Africa/Lagos'),
      v_bk.scheduled_start,
      v_bk.scheduled_end
    )
  order by 3 asc, tp.profile_id asc;
end;
$$;

revoke all on function public.list_reassignment_candidates(uuid) from public;
grant execute on function public.list_reassignment_candidates(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- try_auto_reassign_booking — pick first eligible Guide after cancel / coverage
-- loss. Admin or financial actor (service role) only.
-- Concurrency: FOR UPDATE on booking + soft tutor_is_available + catch
-- exclusion_violation (bookings_no_tutor_overlap) and try next candidate.
-- ---------------------------------------------------------------------------
create or replace function public.try_auto_reassign_booking(p_booking uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bk record;
  v_from uuid;
  v_cand record;
  v_tz text;
  v_name text;
begin
  if not public.is_financial_actor() then
    raise exception 'Not authorized';
  end if;

  -- Serialize concurrent reassignment / release / complete on this booking.
  select * into v_bk from public.bookings where id = p_booking for update;
  if v_bk.id is null then
    raise exception 'Booking not found';
  end if;
  if v_bk.scheduled_start is null or v_bk.scheduled_end is null then
    return jsonb_build_object('status', 'needs_admin', 'reason', 'unscheduled');
  end if;
  if v_bk.status not in ('pending', 'confirmed') then
    return jsonb_build_object('status', 'needs_admin', 'reason', 'not_upcoming');
  end if;
  if v_bk.tutor_id is null then
    return jsonb_build_object('status', 'needs_admin', 'reason', 'unassigned');
  end if;

  v_from := v_bk.tutor_id;

  for v_cand in
    select
      tp.profile_id as tutor_id,
      coalesce(tp.timezone, 'Africa/Lagos') as tz,
      pr.display_name,
      (
        select count(*)::bigint
        from public.bookings b3
        where b3.tutor_id = tp.profile_id
          and b3.status in ('pending', 'confirmed')
          and b3.scheduled_start >= now()
      ) as upcoming_load
    from public.tutor_profiles tp
    join public.profiles pr on pr.id = tp.profile_id
    where tp.status = 'approved'
      and pr.role = 'tutor'
      and coalesce(btrim(tp.timezone), '') <> ''
      and tp.profile_id is distinct from v_from
    order by upcoming_load asc, tp.profile_id asc
  loop
    if public.tutor_is_available(v_cand.tutor_id, v_cand.tz, v_bk.scheduled_start, v_bk.scheduled_end) then
      begin
        update public.bookings
           set tutor_id = v_cand.tutor_id,
               tutor_display_name = v_cand.display_name
         where id = p_booking;

        -- Resolve any open Guide cancellation request for this booking.
        update public.tutor_cancellation_requests
           set status = 'resolved',
               resolved_at = now(),
               resolved_by = auth.uid()
         where booking_id = p_booking
           and status = 'open';

        perform public.log_admin_action(
          'auto_reassign_tutor',
          'bookings',
          p_booking,
          jsonb_build_object('tutor_id', v_from),
          jsonb_build_object('tutor_id', v_cand.tutor_id),
          'automatic Guide reassignment after cancellation/unavailability'
        );

        return jsonb_build_object(
          'status', 'reassigned',
          'from_tutor', v_from,
          'to_tutor', v_cand.tutor_id
        );
      exception
        when exclusion_violation then
          -- Concurrent booking claimed this Guide; try next candidate.
          continue;
      end;
    end if;
  end loop;

  return jsonb_build_object(
    'status', 'needs_admin',
    'reason', 'no_eligible_guide',
    'from_tutor', v_from
  );
end;
$$;

revoke all on function public.try_auto_reassign_booking(uuid) from public;
grant execute on function public.try_auto_reassign_booking(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- admin_reassign_tutor — same eligibility as auto path; subject expertise
-- removed; exclusion_violation mapped to a clear error (GiST remains authority).
-- ---------------------------------------------------------------------------
create or replace function public.admin_reassign_tutor(p_booking uuid, p_new_tutor uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bk record;
  v_tz text;
  v_name text;
  v_ok boolean;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Not authorized';
  end if;

  select * into v_bk from public.bookings where id = p_booking for update;
  if v_bk.id is null then
    raise exception 'Booking not found';
  end if;
  if v_bk.scheduled_start is null or v_bk.scheduled_end is null then
    raise exception 'Only scheduled bookings can be reassigned';
  end if;
  if v_bk.status not in ('pending', 'confirmed') then
    raise exception 'Cannot reassign a % booking', v_bk.status;
  end if;
  if p_new_tutor = v_bk.tutor_id then
    raise exception 'Already assigned to that Guide';
  end if;

  select coalesce(tp.timezone, 'Africa/Lagos'), pr.display_name
    into v_tz, v_name
    from public.tutor_profiles tp
    join public.profiles pr on pr.id = tp.profile_id
   where tp.profile_id = p_new_tutor
     and tp.status = 'approved'
     and pr.role = 'tutor'
     and coalesce(btrim(tp.timezone), '') <> '';

  if v_tz is null then
    raise exception 'Replacement is not an approved Guide';
  end if;

  -- Continuous availability for the entire booked interval (weekly block +
  -- exceptions + soft overlap check). Subject expertise is irrelevant.
  v_ok := public.tutor_is_available(p_new_tutor, v_tz, v_bk.scheduled_start, v_bk.scheduled_end);
  if not v_ok then
    raise exception 'Replacement Guide is not continuously available for that Study Hall';
  end if;

  begin
    update public.bookings
       set tutor_id = p_new_tutor,
           tutor_display_name = v_name
     where id = p_booking;
  exception
    when exclusion_violation then
      raise exception 'Replacement Guide is already booked for that time';
  end;

  perform public.log_admin_action(
    'reassign_tutor',
    'bookings',
    p_booking,
    jsonb_build_object('tutor_id', v_bk.tutor_id),
    jsonb_build_object('tutor_id', p_new_tutor),
    p_reason
  );

  return jsonb_build_object(
    'status', 'reassigned',
    'from_tutor', v_bk.tutor_id,
    'to_tutor', p_new_tutor
  );
end;
$$;

revoke all on function public.admin_reassign_tutor(uuid, uuid, text) from public;
grant execute on function public.admin_reassign_tutor(uuid, uuid, text) to authenticated, service_role;

notify pgrst, 'reload schema';
