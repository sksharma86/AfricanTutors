-- =============================================================================
-- Study Hall PR9 — recording retention (60 days), parent visibility, deletion
--
-- Goals:
--   * Stamp retention_until = ready_at + 60 days when a recording completes
--   * Parent/account holder may SELECT safe recording columns for own bookings
--   * deleted_at marks provider-confirmed deletion (access denied thereafter)
--   * Service-only mark_recording_deleted for the retention cron
--
-- Does NOT change pricing, free session, booking/T−5, Call Parent, or PR8 notify.
-- Forward-only. Do NOT apply to production from the agent.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Lifecycle columns
-- ---------------------------------------------------------------------------
alter table public.session_recordings
  add column if not exists deleted_at timestamptz;

alter table public.session_recordings
  add column if not exists deletion_error text;

comment on column public.session_recordings.retention_until is
  'Study Hall PR9: recording available until this instant (ready/completed_at + 60 days).';
comment on column public.session_recordings.deleted_at is
  'Study Hall PR9: set only after Daily (or provider) deletion succeeds.';
comment on column public.session_recordings.deletion_error is
  'Last provider deletion failure message; cleared on successful delete. Retryable.';

create index if not exists session_recordings_retention_due_idx
  on public.session_recordings (retention_until)
  where status = 'completed'
    and deleted_at is null
    and daily_recording_id is not null
    and retention_until is not null;

-- ---------------------------------------------------------------------------
-- record_recording_event — stamp 60-day retention on completed artifacts.
-- Duplicate webhooks do not move retention_until once set.
-- ---------------------------------------------------------------------------
create or replace function public.record_recording_event(
  p_booking uuid,
  p_status text,
  p_recording_id text default null,
  p_instance_id text default null,
  p_room_name text default null,
  p_started_at timestamptz default null,
  p_completed_at timestamptz default null,
  p_duration integer default null,
  p_max_participants integer default null,
  p_storage_key text default null,
  p_share_token text default null,
  p_error text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_ready timestamptz;
  v_retention timestamptz;
begin
  if not public.is_financial_actor() then raise exception 'Not authorized'; end if;
  if p_booking is null then raise exception 'booking is required'; end if;
  if p_status not in ('processing', 'completed', 'failed') then raise exception 'invalid status'; end if;

  v_ready := coalesce(p_completed_at, now());
  v_retention := case when p_status = 'completed' then v_ready + interval '60 days' else null end;

  if p_recording_id is not null then
    insert into public.session_recordings (
      booking_id, daily_recording_id, daily_instance_id, room_name, status, started_at, completed_at,
      duration_seconds, max_participants, storage_key, share_token, error_message, retention_until)
    values (p_booking, p_recording_id, p_instance_id, p_room_name, p_status, p_started_at, p_completed_at,
      p_duration, p_max_participants, p_storage_key, p_share_token, p_error, v_retention)
    on conflict (daily_recording_id) where daily_recording_id is not null do update set
      status = excluded.status,
      completed_at = coalesce(excluded.completed_at, public.session_recordings.completed_at),
      started_at = coalesce(public.session_recordings.started_at, excluded.started_at),
      duration_seconds = coalesce(excluded.duration_seconds, public.session_recordings.duration_seconds),
      max_participants = coalesce(excluded.max_participants, public.session_recordings.max_participants),
      storage_key = coalesce(excluded.storage_key, public.session_recordings.storage_key),
      share_token = coalesce(excluded.share_token, public.session_recordings.share_token),
      room_name = coalesce(public.session_recordings.room_name, excluded.room_name),
      error_message = coalesce(excluded.error_message, public.session_recordings.error_message),
      retention_until = coalesce(public.session_recordings.retention_until, excluded.retention_until),
      updated_at = now()
    returning id into v_id;
    return v_id;
  end if;

  if p_instance_id is not null then
    insert into public.session_recordings (
      booking_id, daily_instance_id, room_name, status, started_at, error_message)
    values (p_booking, p_instance_id, p_room_name, p_status, p_started_at, p_error)
    on conflict (daily_instance_id) where daily_instance_id is not null do update set
      status = excluded.status,
      error_message = coalesce(excluded.error_message, public.session_recordings.error_message),
      updated_at = now()
    returning id into v_id;
    return v_id;
  end if;

  insert into public.session_recordings (
    booking_id, room_name, status, started_at, error_message, retention_until)
  values (p_booking, p_room_name, p_status, p_started_at, p_error, v_retention)
  returning id into v_id;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- mark_recording_deleted — set deleted_at after provider delete succeeds.
-- Idempotent: already-deleted rows return true without changing timestamps.
-- ---------------------------------------------------------------------------
create or replace function public.mark_recording_deleted(
  p_id uuid,
  p_clear_error boolean default true
) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_financial_actor() then raise exception 'Not authorized'; end if;
  if p_id is null then raise exception 'recording id required'; end if;

  update public.session_recordings
     set deleted_at = coalesce(deleted_at, now()),
         deletion_error = case when p_clear_error then null else deletion_error end,
         updated_at = now()
   where id = p_id;

  return found;
end;
$$;

create or replace function public.mark_recording_deletion_failed(
  p_id uuid,
  p_error text
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_financial_actor() then raise exception 'Not authorized'; end if;
  update public.session_recordings
     set deletion_error = left(coalesce(p_error, 'deletion failed'), 500),
         updated_at = now()
   where id = p_id
     and deleted_at is null;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS: admin OR owning parent/account (booking.account_id). Guides: no access.
-- Sensitive columns (share_token, storage_key, error_message) revoked from
-- authenticated so parents never receive provider internals via PostgREST.
-- ---------------------------------------------------------------------------
drop policy if exists session_recordings_admin_select on public.session_recordings;
drop policy if exists session_recordings_select on public.session_recordings;
create policy session_recordings_select on public.session_recordings
  for select to authenticated
  using (
    public.is_admin(auth.uid())
    or exists (
      select 1 from public.bookings b
       where b.id = session_recordings.booking_id
         and b.account_id = auth.uid()
    )
  );

revoke all on public.session_recordings from public;
grant select (
  id, booking_id, daily_recording_id, daily_instance_id, room_name, status,
  started_at, completed_at, duration_seconds, max_participants, storage_provider,
  archived_at, retention_until, deleted_at, created_at, updated_at
) on public.session_recordings to authenticated;
grant all on public.session_recordings to service_role;

do $$
declare fn text;
begin
  for fn in select unnest(array[
    'record_recording_event(uuid,text,text,text,text,timestamptz,timestamptz,integer,integer,text,text,text)',
    'mark_recording_deleted(uuid,boolean)',
    'mark_recording_deletion_failed(uuid,text)'
  ]) loop
    execute format('revoke all on function public.%s from public', fn);
    execute format('grant execute on function public.%s to authenticated, service_role', fn);
  end loop;
end $$;

notify pgrst, 'reload schema';
