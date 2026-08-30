-- =============================================================================
-- Guide pre-session attendance confirmation
-- =============================================================================
-- One durable row per Guide ASSIGNMENT (not merely per booking). When Guide A
-- misses and Management assigns Guide B, A's confirmation state cannot carry
-- over. History is retained so a later reliability metric can count misses
-- without building scoring/suspension in this migration.
--
-- Why a table (not booking booleans):
--   * assignment-scoped confirm / miss / resolve
--   * auditable request + deadline + timestamps
--   * replacement Guides get their own row
--   * missed rows stay after reassignment for reliability history
-- =============================================================================

create table if not exists public.guide_attendance_assignments (
  id              uuid primary key default gen_random_uuid(),
  booking_id      uuid not null references public.bookings (id) on delete cascade,
  tutor_id        uuid not null references public.profiles (id) on delete cascade,
  source          text not null default 't30'
                    check (source in ('t30', 'replacement', 'short_notice')),
  status          text not null default 'awaiting'
                    check (status in ('awaiting', 'confirmed', 'missed', 'superseded', 'voided')),
  requested_at    timestamptz not null default now(),
  deadline_at     timestamptz not null,
  confirmed_at    timestamptz,
  missed_at       timestamptz,
  resolved_at     timestamptz,
  resolved_by     uuid references public.profiles (id) on delete set null,
  resolution      text
                    check (resolution is null or resolution in (
                      'reassigned',
                      'cancelled_coverage',
                      'booking_cancelled',
                      'booking_completed',
                      'rescheduled'
                    )),
  replaced_by_assignment_id uuid references public.guide_attendance_assignments (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists gaa_booking_idx
  on public.guide_attendance_assignments (booking_id, created_at desc);
create index if not exists gaa_tutor_status_idx
  on public.guide_attendance_assignments (tutor_id, status);
create index if not exists gaa_awaiting_deadline_idx
  on public.guide_attendance_assignments (deadline_at)
  where status = 'awaiting';
create index if not exists gaa_missed_unresolved_idx
  on public.guide_attendance_assignments (booking_id)
  where status = 'missed' and resolved_at is null;

-- One open confirmation request per booking.
create unique index if not exists gaa_one_awaiting_per_booking
  on public.guide_attendance_assignments (booking_id)
  where status = 'awaiting';

-- ---------------------------------------------------------------------------
-- open_guide_attendance_assignment — persist a request for the CURRENT Guide.
-- Idempotent. Service / admin / trigger. Does not notify (app layer does).
-- ---------------------------------------------------------------------------
create or replace function public.open_guide_attendance_assignment(p_booking uuid, p_source text)
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
  if p_source is null or p_source not in ('t30', 'replacement', 'short_notice') then
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
  if v_source = 't30' then
    v_deadline := v_bk.scheduled_start - interval '20 minutes';
    if now() > v_deadline then
      -- Cron / trigger arrived after T-20: persist the miss instead of a dead window.
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

-- ---------------------------------------------------------------------------
-- confirm_guide_attendance — assigned Guide only. Idempotent. Exactly at
-- deadline is allowed; after deadline is not.
-- ---------------------------------------------------------------------------
create or replace function public.confirm_guide_attendance(p_booking uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_bk record;
  v_row record;
  v_open timestamptz;
  v_deadline timestamptz;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'Not authorized';
  end if;

  select id, tutor_id, status, scheduled_start
    into v_bk
    from public.bookings
   where id = p_booking
     for update;
  if v_bk.id is null then
    raise exception 'Booking not found';
  end if;
  if v_bk.status is distinct from 'confirmed' then
    raise exception 'Booking is not eligible for attendance confirmation';
  end if;
  if v_bk.tutor_id is null or v_bk.tutor_id is distinct from v_uid then
    raise exception 'Not authorized to confirm this Study Hall';
  end if;

  select * into v_row
    from public.guide_attendance_assignments
   where booking_id = p_booking
     and tutor_id = v_uid
     and status in ('awaiting', 'confirmed', 'missed')
   order by created_at desc
   limit 1
   for update;

  if v_row.id is not null then
    if v_row.status = 'confirmed' then
      return jsonb_build_object('status', 'confirmed', 'id', v_row.id, 'idempotent', true);
    end if;
    if v_row.status = 'missed' or now() > v_row.deadline_at then
      raise exception 'Confirmation deadline has passed';
    end if;

    update public.guide_attendance_assignments
       set status = 'confirmed',
           confirmed_at = now(),
           updated_at = now()
     where id = v_row.id
       and status = 'awaiting';

    perform public.log_admin_action(
      'guide_attendance_confirmed',
      'guide_attendance_assignments',
      v_row.id,
      jsonb_build_object('status', 'awaiting'),
      jsonb_build_object('status', 'confirmed', 'tutor_id', v_uid),
      'guide confirmed attendance'
    );
    return jsonb_build_object('status', 'confirmed', 'id', v_row.id, 'idempotent', false);
  end if;

  -- Cron has not persisted yet: allow confirm inside the standard T-30 window.
  if v_bk.scheduled_start is null then
    raise exception 'Booking is not eligible for attendance confirmation';
  end if;
  v_open := v_bk.scheduled_start - interval '30 minutes';
  v_deadline := v_bk.scheduled_start - interval '20 minutes';
  if now() < v_open then
    raise exception 'Confirmation is not open yet';
  end if;
  if now() > v_deadline then
    raise exception 'Confirmation deadline has passed';
  end if;

  insert into public.guide_attendance_assignments (
    booking_id, tutor_id, source, status, requested_at, deadline_at, confirmed_at
  ) values (
    p_booking, v_uid, 't30', 'confirmed', now(), v_deadline, now()
  )
  returning id into v_id;

  perform public.log_admin_action(
    'guide_attendance_confirmed',
    'guide_attendance_assignments',
    v_id,
    null,
    jsonb_build_object('status', 'confirmed', 'tutor_id', v_uid, 'opened_on_confirm', true),
    'guide confirmed attendance'
  );
  return jsonb_build_object('status', 'confirmed', 'id', v_id, 'idempotent', false);
end;
$$;

-- ---------------------------------------------------------------------------
-- sweep_guide_attendance — open due T-30 windows + persist T-20 misses.
-- Idempotent. Service role / financial actor only.
-- ---------------------------------------------------------------------------
create or replace function public.sweep_guide_attendance()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bk record;
  v_row record;
  v_open jsonb;
  v_opened jsonb := '[]'::jsonb;
  v_missed jsonb := '[]'::jsonb;
begin
  if not public.is_financial_actor() then
    raise exception 'Not authorized';
  end if;

  for v_bk in
    select id
      from public.bookings
     where status = 'confirmed'
       and tutor_id is not null
       and scheduled_start is not null
       and scheduled_start > now()
       and scheduled_start <= now() + interval '30 minutes'
  loop
    v_open := public.open_guide_attendance_assignment(v_bk.id, 't30');
    if (v_open ->> 'created') = 'true' then
      v_opened := v_opened || jsonb_build_array(v_open);
    end if;
  end loop;

  for v_row in
    select id, booking_id, tutor_id
      from public.guide_attendance_assignments
     where status = 'awaiting'
       and now() > deadline_at
     for update skip locked
  loop
    update public.guide_attendance_assignments
       set status = 'missed',
           missed_at = coalesce(missed_at, now()),
           updated_at = now()
     where id = v_row.id
       and status = 'awaiting';
    if found then
      perform public.log_admin_action(
        'guide_attendance_missed',
        'guide_attendance_assignments',
        v_row.id,
        jsonb_build_object('status', 'awaiting'),
        jsonb_build_object('status', 'missed', 'tutor_id', v_row.tutor_id, 'booking_id', v_row.booking_id),
        'confirmation deadline missed'
      );
      v_missed := v_missed || jsonb_build_array(jsonb_build_object(
        'id', v_row.id,
        'booking_id', v_row.booking_id,
        'tutor_id', v_row.tutor_id,
        'status', 'missed'
      ));
    end if;
  end loop;

  return jsonb_build_object('opened', v_opened, 'missed', v_missed);
end;
$$;

-- ---------------------------------------------------------------------------
-- Keep assignment rows aligned with booking assignment / lifecycle changes.
-- Does not update bookings (no recursion).
-- ---------------------------------------------------------------------------
create or replace function public.sync_guide_attendance_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source text;
  v_new_id uuid;
  v_old_ids uuid[];
begin
  if TG_OP = 'UPDATE' and NEW.status not in ('pending', 'confirmed') then
    update public.guide_attendance_assignments
       set status = case when status = 'awaiting' then 'voided' else status end,
           resolved_at = coalesce(resolved_at, now()),
           resolution = coalesce(
             resolution,
             case
               when NEW.status = 'cancelled' then 'booking_cancelled'
               else 'booking_completed'
             end
           ),
           updated_at = now()
     where booking_id = NEW.id
       and status in ('awaiting', 'missed');
    return NEW;
  end if;

  if TG_OP = 'UPDATE' and (
       NEW.tutor_id is distinct from OLD.tutor_id
    or NEW.scheduled_start is distinct from OLD.scheduled_start
  ) then
    select coalesce(array_agg(id), '{}') into v_old_ids
      from public.guide_attendance_assignments
     where booking_id = NEW.id
       and status in ('awaiting', 'confirmed', 'missed');

    update public.guide_attendance_assignments
       set status = case
             when status = 'awaiting' then 'superseded'
             when status = 'confirmed' then
               case
                 when NEW.tutor_id is distinct from OLD.tutor_id then 'superseded'
                 else 'voided'
               end
             else status
           end,
           resolved_at = case
             when status = 'missed' and resolved_at is null then now()
             when status in ('awaiting', 'confirmed') then coalesce(resolved_at, now())
             else resolved_at
           end,
           resolution = case
             when NEW.scheduled_start is distinct from OLD.scheduled_start
                  and NEW.tutor_id is not distinct from OLD.tutor_id
               then 'rescheduled'
             when NEW.tutor_id is distinct from OLD.tutor_id then 'reassigned'
             else resolution
           end,
           resolved_by = auth.uid(),
           updated_at = now()
     where booking_id = NEW.id
       and status in ('awaiting', 'confirmed', 'missed');
  end if;

  if NEW.status = 'confirmed'
     and NEW.tutor_id is not null
     and NEW.scheduled_start is not null
     and now() >= NEW.scheduled_start - interval '30 minutes'
     and now() < coalesce(NEW.scheduled_end, NEW.scheduled_start + interval '3 hours')
  then
    if TG_OP = 'UPDATE' and NEW.tutor_id is distinct from OLD.tutor_id then
      v_source := 'replacement';
    elsif now() >= NEW.scheduled_start - interval '20 minutes' then
      v_source := 'short_notice';
    else
      v_source := 't30';
    end if;
    v_new_id := (public.open_guide_attendance_assignment(NEW.id, v_source) ->> 'id')::uuid;
    if v_new_id is not null and v_old_ids is not null then
      update public.guide_attendance_assignments
         set replaced_by_assignment_id = v_new_id
       where id = any(v_old_ids);
    end if;
  end if;

  return NEW;
end;
$$;

drop trigger if exists bookings_guide_attendance_aiu on public.bookings;
create trigger bookings_guide_attendance_aiu
  after insert or update of tutor_id, status, scheduled_start
  on public.bookings
  for each row
  execute function public.sync_guide_attendance_assignment();

-- RLS: Guide reads own rows; admins read all. Writes only via DEFINER RPCs.
alter table public.guide_attendance_assignments enable row level security;
drop policy if exists gaa_select on public.guide_attendance_assignments;
create policy gaa_select on public.guide_attendance_assignments
  for select to authenticated
  using (tutor_id = auth.uid() or public.is_admin(auth.uid()));

grant select on public.guide_attendance_assignments to authenticated;
grant all on public.guide_attendance_assignments to service_role;

revoke all on function public.open_guide_attendance_assignment(uuid, text) from public;
revoke all on function public.confirm_guide_attendance(uuid) from public;
revoke all on function public.sweep_guide_attendance() from public;
-- Open/sweep are cron + trigger + service only. Guides confirm via confirm_guide_attendance.
grant execute on function public.open_guide_attendance_assignment(uuid, text) to service_role;
grant execute on function public.confirm_guide_attendance(uuid) to authenticated, service_role;
grant execute on function public.sweep_guide_attendance() to service_role;

notify pgrst, 'reload schema';
