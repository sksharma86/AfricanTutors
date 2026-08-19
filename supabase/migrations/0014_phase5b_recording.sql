-- =============================================================================
-- African Tutors — Phase 5B: automatic session recording (Daily cloud recording)
-- =============================================================================
-- Recordings are authoritatively tied to the booking (via the deterministic
-- Phase 5A room name). Normalized `session_recordings` (a booking can produce
-- multiple artifacts: reconnects/restarts/failures). Admin-only visibility; no
-- permanent public URLs are ever stored (playback uses short-lived Daily access
-- links generated server-side after admin authorization). Recording status is
-- operational evidence ONLY — it never drives booking completion or earnings
-- (Phase 4 remains authoritative). `bookings.recording_ref` from Phase 4C is now
-- LEGACY/convenience; `session_recordings` is the source of truth. Idempotent.
-- =============================================================================

create table if not exists public.session_recordings (
  id                 uuid primary key default gen_random_uuid(),
  booking_id         uuid not null references public.bookings (id) on delete cascade,
  daily_recording_id text,
  daily_instance_id  text,
  room_name          text,
  status             text not null default 'processing' check (status in ('processing', 'completed', 'failed')),
  started_at         timestamptz,
  completed_at       timestamptz,
  duration_seconds   integer,
  max_participants   integer,
  storage_provider   text not null default 'daily',   -- 'daily' (Mode A) | 's3' (Mode B, future)
  storage_key        text,                            -- provider object key; NEVER a public URL
  share_token        text,                            -- Daily share token (server-only)
  error_message      text,
  archived_at        timestamptz,                     -- lifecycle metadata (future archival)
  retention_until    timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists session_recordings_booking_idx on public.session_recordings (booking_id);
create unique index if not exists session_recordings_recording_id_key on public.session_recordings (daily_recording_id) where daily_recording_id is not null;
create unique index if not exists session_recordings_instance_id_key on public.session_recordings (daily_instance_id) where daily_instance_id is not null;

drop trigger if exists session_recordings_touch on public.session_recordings;
create trigger session_recordings_touch before update on public.session_recordings
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- record_recording_event — upsert a recording artifact from a verified Daily
-- webhook. Admin/service only (is_financial_actor). Idempotent per Daily
-- recording id (completed/processing) or instance id (errors) so duplicate or
-- out-of-order deliveries never create duplicate rows. The caller passes the
-- booking id it derived + verified from the room name (never client-supplied).
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
declare v_id uuid;
begin
  if not public.is_financial_actor() then raise exception 'Not authorized'; end if;
  if p_booking is null then raise exception 'booking is required'; end if;
  if p_status not in ('processing', 'completed', 'failed') then raise exception 'invalid status'; end if;

  if p_recording_id is not null then
    insert into public.session_recordings (
      booking_id, daily_recording_id, daily_instance_id, room_name, status, started_at, completed_at,
      duration_seconds, max_participants, storage_key, share_token, error_message)
    values (p_booking, p_recording_id, p_instance_id, p_room_name, p_status, p_started_at, p_completed_at,
      p_duration, p_max_participants, p_storage_key, p_share_token, p_error)
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

  insert into public.session_recordings (booking_id, room_name, status, started_at, error_message)
  values (p_booking, p_room_name, p_status, p_started_at, p_error)
  returning id into v_id;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS: recordings are ADMIN-ONLY (customers/tutors have no recording access in
-- Phase 5B). Never client-writable (webhook writes via the DEFINER function).
-- ---------------------------------------------------------------------------
alter table public.session_recordings enable row level security;
drop policy if exists session_recordings_admin_select on public.session_recordings;
create policy session_recordings_admin_select on public.session_recordings for select to authenticated
  using (public.is_admin(auth.uid()));

grant select on public.session_recordings to authenticated;
grant all on public.session_recordings to service_role;

do $$
declare fn text;
begin
  for fn in select unnest(array['record_recording_event(uuid,text,text,text,text,timestamptz,timestamptz,integer,integer,text,text,text)']) loop
    execute format('revoke all on function public.%s from public', fn);
    execute format('grant execute on function public.%s to authenticated, service_role', fn);
  end loop;
end $$;

notify pgrst, 'reload schema';
