-- Automatic emergency Guide replacement after a T-20 attendance miss.
-- 0034 is installed and must not be edited. This migration adds:
--   * source 'emergency' on attendance assignments (distinct from ordinary replacement)
--   * durable per-Guide open-coverage offers (one per miss cycle)
--   * service-role candidate list matching list_reassignment_candidates (0026)
--   * atomic first-claim RPC that reassigns + confirms attendance
--   * automatic offer close on cancel / tutor change / T-2 protection
-- Does not alter T-30 / T-20 / T-10 / T-2, compensation, Parent SMS, or pricing.

-- ---------------------------------------------------------------------------
-- Attendance source: emergency replacement / open coverage
-- ---------------------------------------------------------------------------

alter table public.guide_attendance_assignments
  drop constraint if exists guide_attendance_assignments_source_check;

alter table public.guide_attendance_assignments
  add constraint guide_attendance_assignments_source_check
  check (source in ('t30', 'replacement', 'short_notice', 'emergency'));

-- Preserve 0034 open semantics. Only the source allow-list grows.
create or replace function public.open_guide_attendance_assignment(p_booking uuid, p_source text, p_deadline timestamptz default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bk record;
  v_existing record;
  v_deadline timestamptz;
  v_source text;
  v_status text;
  v_id uuid;
begin
  if p_source is null or p_source not in ('t30', 'replacement', 'short_notice', 'emergency') then
    raise exception 'invalid confirmation source';
  end if;

  select id, tutor_id, status, scheduled_start, scheduled_end
    into v_bk
    from public.bookings
   where id = p_booking
     for update;
  if v_bk.id is null then
    raise exception 'Booking not found';
  end if;
  if v_bk.status is distinct from 'confirmed' then
    return jsonb_build_object('status', 'skipped', 'reason', 'not_confirmed');
  end if;
  if v_bk.tutor_id is null or v_bk.scheduled_start is null then
    return jsonb_build_object('status', 'skipped', 'reason', 'no_assignment');
  end if;

  select * into v_existing
    from public.guide_attendance_assignments
   where booking_id = p_booking
     and tutor_id = v_bk.tutor_id
     and status in ('awaiting', 'confirmed', 'missed')
   order by created_at desc
   limit 1;

  if v_existing.id is not null then
    if v_existing.status = 'awaiting' or v_existing.status = 'confirmed' then
      return jsonb_build_object('status', v_existing.status, 'id', v_existing.id, 'created', false);
    end if;
    if v_existing.status = 'missed' and v_existing.resolved_at is null then
      return jsonb_build_object('status', 'missed', 'id', v_existing.id, 'created', false);
    end if;
  end if;

  v_source := p_source;
  if p_deadline is not null then
    v_deadline := p_deadline;
    if v_source = 't30' and now() > v_deadline then
      v_status := 'missed';
    else
      v_status := 'awaiting';
    end if;
  elsif v_source = 't30' then
    v_deadline := v_bk.scheduled_start - interval '20 minutes';
    if now() > v_deadline then
      v_status := 'missed';
    else
      v_status := 'awaiting';
    end if;
  else
    v_deadline := now() + interval '10 minutes';
    v_status := 'awaiting';
  end if;

  insert into public.guide_attendance_assignments (
    booking_id, tutor_id, source, status, requested_at, deadline_at, missed_at
  ) values (
    p_booking,
    v_bk.tutor_id,
    v_source,
    v_status,
    now(),
    v_deadline,
    case when v_status = 'missed' then now() else null end
  )
  returning id into v_id;

  perform public.log_admin_action(
    case when v_status = 'missed' then 'guide_attendance_missed' else 'guide_attendance_requested' end,
    'guide_attendance_assignments',
    v_id,
    null,
    jsonb_build_object(
      'booking_id', p_booking,
      'tutor_id', v_bk.tutor_id,
      'source', v_source,
      'deadline_at', v_deadline
    ),
    v_source
  );

  return jsonb_build_object('status', v_status, 'id', v_id, 'created', true, 'tutor_id', v_bk.tutor_id);
end;
$$;

revoke all on function public.open_guide_attendance_assignment(uuid, text, timestamptz) from public;
grant execute on function public.open_guide_attendance_assignment(uuid, text, timestamptz) to service_role;

-- ---------------------------------------------------------------------------
-- Durable open-coverage offers
-- ---------------------------------------------------------------------------

create table if not exists public.guide_open_coverage_offers (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  tutor_id uuid not null references public.profiles(id) on delete cascade,
  search_key uuid not null,
  status text not null default 'open'
    check (status in ('open', 'claimed', 'closed')),
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  closed_at timestamptz,
  close_reason text,
  unique (booking_id, tutor_id, search_key)
);

create index if not exists guide_open_coverage_offers_booking_idx
  on public.guide_open_coverage_offers (booking_id, status);

create index if not exists guide_open_coverage_offers_tutor_idx
  on public.guide_open_coverage_offers (tutor_id, status);

alter table public.guide_open_coverage_offers enable row level security;

drop policy if exists guide_open_coverage_offers_select_own on public.guide_open_coverage_offers;
create policy guide_open_coverage_offers_select_own
  on public.guide_open_coverage_offers
  for select
  to authenticated
  using (tutor_id = auth.uid());

drop policy if exists guide_open_coverage_offers_admin_all on public.guide_open_coverage_offers;
create policy guide_open_coverage_offers_admin_all
  on public.guide_open_coverage_offers
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select on public.guide_open_coverage_offers to authenticated;
grant all on public.guide_open_coverage_offers to service_role;

comment on table public.guide_open_coverage_offers is
  'Private per-Guide emergency coverage offers. One row per Guide per missed-assignment search cycle.';

-- ---------------------------------------------------------------------------
-- Eligibility: same engine as list_reassignment_candidates (0026)
-- ---------------------------------------------------------------------------

create or replace function public.list_emergency_coverage_candidates(p_booking uuid)
returns table (
  tutor_id uuid,
  display_name text,
  timezone text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bk record;
begin
  if not public.is_financial_actor() then
    raise exception 'not authorized';
  end if;

  select id, tutor_id, scheduled_start, scheduled_end, status
    into v_bk
    from public.bookings
   where id = p_booking;

  if v_bk.id is null then
    raise exception 'booking not found';
  end if;
  if v_bk.scheduled_start is null or v_bk.scheduled_end is null then
    return;
  end if;

  return query
  select
    tp.profile_id,
    pr.display_name,
    coalesce(tp.timezone, 'Africa/Lagos')
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
  order by pr.display_name, tp.profile_id;
end;
$$;

revoke all on function public.list_emergency_coverage_candidates(uuid) from public;
grant execute on function public.list_emergency_coverage_candidates(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Open one replacement-search cycle (idempotent inserts)
-- ---------------------------------------------------------------------------

create or replace function public.open_emergency_coverage_search(
  p_booking uuid,
  p_search_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings%rowtype;
  v_current public.guide_attendance_assignments%rowtype;
  v_candidate record;
  v_created int := 0;
  v_existing int := 0;
  v_candidates jsonb := '[]'::jsonb;
begin
  if not public.is_financial_actor() then
    raise exception 'not authorized';
  end if;
  if p_search_key is null then
    raise exception 'search key required';
  end if;

  select * into v_booking
    from public.bookings
   where id = p_booking
     for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  if v_booking.status is distinct from 'confirmed' then
    return jsonb_build_object('ok', false, 'reason', 'not_confirmed');
  end if;
  if v_booking.tutor_id is null then
    return jsonb_build_object('ok', false, 'reason', 'unassigned');
  end if;
  if now() >= v_booking.scheduled_start then
    return jsonb_build_object('ok', false, 'reason', 'already_started');
  end if;

  select *
    into v_current
    from public.guide_attendance_assignments
   where booking_id = p_booking
     and tutor_id = v_booking.tutor_id
     and status is distinct from 'superseded'
   order by created_at desc
   limit 1;

  if v_current.id is null or v_current.status is distinct from 'missed' then
    return jsonb_build_object('ok', false, 'reason', 'not_uncovered');
  end if;

  if exists (
    select 1
      from public.guide_attendance_assignments
     where booking_id = p_booking
       and tutor_id = v_booking.tutor_id
       and status = 'confirmed'
  ) then
    return jsonb_build_object('ok', false, 'reason', 'already_covered');
  end if;

  for v_candidate in
    select c.tutor_id, c.display_name, c.timezone
      from public.list_emergency_coverage_candidates(p_booking) c
  loop
    insert into public.guide_open_coverage_offers (
      booking_id, tutor_id, search_key, status
    ) values (
      p_booking, v_candidate.tutor_id, p_search_key, 'open'
    )
    on conflict (booking_id, tutor_id, search_key) do nothing;

    if found then
      v_created := v_created + 1;
    else
      v_existing := v_existing + 1;
    end if;

    v_candidates := v_candidates || jsonb_build_array(
      jsonb_build_object(
        'tutorId', v_candidate.tutor_id,
        'displayName', v_candidate.display_name,
        'timezone', v_candidate.timezone
      )
    );
  end loop;

  perform public.log_admin_action(
    'emergency_coverage_search_opened',
    'bookings',
    p_booking,
    null,
    jsonb_build_object(
      'searchKey', p_search_key,
      'eligibleCount', jsonb_array_length(v_candidates),
      'createdCount', v_created,
      'existingCount', v_existing,
      'failedGuideId', v_booking.tutor_id
    ),
    'emergency'
  );

  return jsonb_build_object(
    'ok', true,
    'bookingId', p_booking,
    'searchKey', p_search_key,
    'createdCount', v_created,
    'existingCount', v_existing,
    'eligibleCount', jsonb_array_length(v_candidates),
    'candidates', v_candidates
  );
end;
$$;

revoke all on function public.open_emergency_coverage_search(uuid, uuid) from public;
grant execute on function public.open_emergency_coverage_search(uuid, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Close remaining open offers
-- ---------------------------------------------------------------------------

create or replace function public.close_open_coverage_offers(
  p_booking uuid,
  p_reason text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  if not (
    public.is_financial_actor()
    or public.is_admin()
  ) then
    raise exception 'not authorized';
  end if;

  update public.guide_open_coverage_offers
     set status = 'closed',
         closed_at = now(),
         close_reason = coalesce(p_reason, 'closed')
   where booking_id = p_booking
     and status = 'open';

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.close_open_coverage_offers(uuid, text) from public;
grant execute on function public.close_open_coverage_offers(uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- Atomic first-claim: reassign + confirm attendance as emergency
-- ---------------------------------------------------------------------------

create or replace function public.claim_open_coverage(p_booking uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_booking public.bookings%rowtype;
  v_offer public.guide_open_coverage_offers%rowtype;
  v_assignment_id uuid;
  v_old_tutor uuid;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'unauthenticated');
  end if;

  select * into v_booking
    from public.bookings
   where id = p_booking
     for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  if v_booking.status is distinct from 'confirmed' then
    update public.guide_open_coverage_offers
       set status = 'closed',
           closed_at = coalesce(closed_at, now()),
           close_reason = coalesce(close_reason, 'booking_cancelled')
     where booking_id = p_booking
       and status = 'open';
    return jsonb_build_object('ok', false, 'reason', 'already_covered');
  end if;
  if now() >= v_booking.scheduled_start then
    update public.guide_open_coverage_offers
       set status = 'closed',
           closed_at = coalesce(closed_at, now()),
           close_reason = coalesce(close_reason, 'session_started')
     where booking_id = p_booking
       and status = 'open';
    return jsonb_build_object('ok', false, 'reason', 'expired');
  end if;

  if exists (
    select 1
      from public.guide_attendance_assignments
     where booking_id = p_booking
       and tutor_id = v_booking.tutor_id
       and status = 'confirmed'
  ) then
    update public.guide_open_coverage_offers
       set status = 'closed',
           closed_at = coalesce(closed_at, now()),
           close_reason = coalesce(close_reason, 'coverage_restored')
     where booking_id = p_booking
       and status = 'open';
    return jsonb_build_object('ok', false, 'reason', 'already_covered');
  end if;

  select *
    into v_offer
    from public.guide_open_coverage_offers
   where booking_id = p_booking
     and tutor_id = v_uid
   order by created_at desc
   limit 1
     for update;

  if v_offer.id is null then
    return jsonb_build_object('ok', false, 'reason', 'already_covered');
  end if;
  if v_offer.status = 'claimed' and v_offer.tutor_id = v_uid then
    return jsonb_build_object('ok', true, 'alreadyConfirmed', true, 'reason', 'already_claimed');
  end if;
  if v_offer.status is distinct from 'open' then
    return jsonb_build_object('ok', false, 'reason', 'already_covered');
  end if;

  if v_booking.tutor_id = v_uid then
    return jsonb_build_object('ok', false, 'reason', 'current_guide');
  end if;

  -- Recheck the same 0026 eligibility engine at click time.
  if not exists (
    select 1
      from public.tutor_profiles tp
      join public.profiles pr on pr.id = tp.profile_id
     where tp.profile_id = v_uid
       and tp.status = 'approved'
       and pr.role = 'tutor'
       and coalesce(btrim(tp.timezone), '') <> ''
       and tp.profile_id is distinct from v_booking.tutor_id
       and v_booking.scheduled_start is not null
       and v_booking.scheduled_end is not null
       and public.tutor_is_available(
         tp.profile_id,
         coalesce(tp.timezone, 'Africa/Lagos'),
         v_booking.scheduled_start,
         v_booking.scheduled_end
       )
  ) then
    update public.guide_open_coverage_offers
       set status = 'closed',
           closed_at = now(),
           close_reason = 'no_longer_eligible'
     where id = v_offer.id
       and status = 'open';
    return jsonb_build_object('ok', false, 'reason', 'not_eligible');
  end if;

  update public.guide_open_coverage_offers
     set status = 'claimed',
         claimed_at = now()
   where id = v_offer.id
     and status = 'open';

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'already_covered');
  end if;

  update public.guide_open_coverage_offers
     set status = 'closed',
         closed_at = now(),
         close_reason = 'claimed_by_other'
   where booking_id = p_booking
     and status = 'open';

  v_old_tutor := v_booking.tutor_id;

  update public.bookings
     set tutor_id = v_uid
   where id = p_booking
     and status = 'confirmed';

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'already_covered');
  end if;

  select id
    into v_assignment_id
    from public.guide_attendance_assignments
   where booking_id = p_booking
     and tutor_id = v_uid
     and status in ('awaiting', 'confirmed')
   order by created_at desc
   limit 1;

  if v_assignment_id is null then
    insert into public.guide_attendance_assignments (
      booking_id, tutor_id, source, status, requested_at, deadline_at
    ) values (
      p_booking, v_uid, 'emergency', 'awaiting', now(), now()
    )
    returning id into v_assignment_id;
  end if;

  update public.guide_attendance_assignments
     set source = 'emergency',
         status = 'confirmed',
         confirmed_at = coalesce(confirmed_at, now()),
         updated_at = now()
   where id = v_assignment_id;

  perform public.log_admin_action(
    'emergency_coverage_claimed',
    'bookings',
    p_booking,
    jsonb_build_object('previousGuideId', v_old_tutor),
    jsonb_build_object(
      'searchKey', v_offer.search_key,
      'offerId', v_offer.id,
      'assignmentId', v_assignment_id,
      'winningGuideId', v_uid
    ),
    'emergency'
  );

  return jsonb_build_object(
    'ok', true,
    'bookingId', p_booking,
    'assignmentId', v_assignment_id,
    'previousGuideId', v_old_tutor
  );
exception
  when exclusion_violation then
    return jsonb_build_object('ok', false, 'reason', 'overlap');
end;
$$;

revoke all on function public.claim_open_coverage(uuid) from public;
grant execute on function public.claim_open_coverage(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Close open offers when booking leaves confirmed or Guide changes
-- ---------------------------------------------------------------------------

create or replace function public.sync_open_coverage_offers()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'UPDATE' then
    if NEW.status is distinct from 'confirmed' then
      update public.guide_open_coverage_offers
         set status = 'closed',
             closed_at = coalesce(closed_at, now()),
             close_reason = coalesce(close_reason, 'booking_cancelled')
       where booking_id = NEW.id
         and status = 'open';
    elsif NEW.tutor_id is distinct from OLD.tutor_id then
      update public.guide_open_coverage_offers
         set status = 'closed',
             closed_at = coalesce(closed_at, now()),
             close_reason = coalesce(close_reason, 'coverage_restored')
       where booking_id = NEW.id
         and status = 'open';
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists bookings_open_coverage_aiu on public.bookings;
create trigger bookings_open_coverage_aiu
  after update of tutor_id, status on public.bookings
  for each row
  execute function public.sync_open_coverage_offers();
