-- =============================================================================
-- Study Hall PR7 — Call Parent escalation (Guide → parent attention)
--
-- Goals:
--   * Assigned Guide can request immediate parental attention during an active
--     Study Hall (join window: T−5 … end+15, status confirmed)
--   * Durable audit trail (parent_escalation_requests)
--   * Parent phone (E.164) on profiles — NEVER exposed to Guides via RLS
--   * 5-minute cooldown per booking
--   * Writes via SECURITY DEFINER RPC; telephony happens in the app layer
--
-- Does NOT change PR2–PR6 pricing, booking, T−5, compensation, or reports.
-- Do NOT apply this migration to production from the agent.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Parent contact phone (account-level). Guides cannot SELECT other profiles
-- (existing RLS: own + admin only), so phone never reaches Guide clients.
-- Full SMS/voice verification is deferred — store safely; verify before launch.
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists phone_e164 text
    check (phone_e164 is null or phone_e164 ~ '^\+[1-9][0-9]{7,14}$');

alter table public.profiles
  add column if not exists phone_updated_at timestamptz;

comment on column public.profiles.phone_e164 is
  'Study Hall PR7: parent contact in E.164. Used server-side for Call Parent; not shown to Guides.';

-- Parent (or admin) sets own phone. Normalizes trivial spaces; full E.164 required.
create or replace function public.set_my_phone(p_phone text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_phone text := nullif(btrim(coalesce(p_phone, '')), '');
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if v_phone is not null and v_phone !~ '^\+[1-9][0-9]{7,14}$' then
    raise exception 'Phone must be in E.164 form (e.g. +15551234567)';
  end if;
  if not public.is_admin(v_uid) and not exists (
    select 1 from public.profiles where id = v_uid and role = 'student'
  ) then
    raise exception 'Not authorized';
  end if;
  update public.profiles
     set phone_e164 = v_phone,
         phone_updated_at = case when v_phone is distinct from phone_e164 then now() else phone_updated_at end
   where id = v_uid;
  return v_phone;
end;
$$;

-- ---------------------------------------------------------------------------
-- Escalation audit log
-- ---------------------------------------------------------------------------
create table if not exists public.parent_escalation_requests (
  id                  uuid primary key default gen_random_uuid(),
  booking_id          uuid not null references public.bookings (id) on delete restrict,
  tutor_id            uuid not null references public.profiles (id) on delete restrict,
  account_id          uuid not null references public.profiles (id) on delete restrict,
  reason              text not null
                        check (reason in (
                          'child_unwell',
                          'refusing_to_work',
                          'needs_parent_assistance',
                          'behavior_issue',
                          'other'
                        )),
  note                text
                        check (note is null or char_length(btrim(note)) between 1 and 200),
  -- pending → app places call/SMS → terminal outcome
  status              text not null default 'pending'
                        check (status in (
                          'pending',
                          'call_placed',
                          'sms_sent',
                          'failed',
                          'not_configured'
                        )),
  call_provider       text,
  call_sid            text,
  call_status         text,
  sms_sid             text,
  sms_status          text,
  outcome             text
                        check (outcome is null or outcome in (
                          'call', 'sms', 'failed', 'not_configured', 'no_phone'
                        )),
  error_detail        text,
  created_at          timestamptz not null default now(),
  call_attempted_at   timestamptz,
  sms_attempted_at    timestamptz,
  completed_at        timestamptz
);

create index if not exists per_booking_created_idx
  on public.parent_escalation_requests (booking_id, created_at desc);
create index if not exists per_account_created_idx
  on public.parent_escalation_requests (account_id, created_at desc);
create index if not exists per_status_idx
  on public.parent_escalation_requests (status, created_at desc);

comment on table public.parent_escalation_requests is
  'Study Hall PR7: Guide Call Parent escalations. Never store parent phone on this row.';

-- ---------------------------------------------------------------------------
-- request_parent_escalation — authorize + insert pending row + 5-min cooldown.
-- Does NOT place the call (app layer uses service role for phone + Twilio).
-- Returns escalation id only (never phone).
-- ---------------------------------------------------------------------------
create or replace function public.request_parent_escalation(
  p_booking uuid,
  p_reason text,
  p_note text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_bk record;
  v_id uuid;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_open timestamptz;
  v_close timestamptz;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select id, tutor_id, account_id, status, scheduled_start, scheduled_end, duration_minutes
    into v_bk
    from public.bookings
   where id = p_booking;

  if v_bk.id is null then
    raise exception 'Booking not found';
  end if;

  if v_bk.tutor_id is null then
    raise exception 'This booking has no assigned Guide';
  end if;

  -- Assigned Guide only (admins may assist operationally).
  if v_uid is distinct from v_bk.tutor_id and not public.is_admin(v_uid) then
    raise exception 'Not authorized';
  end if;

  if v_bk.status is distinct from 'confirmed' then
    raise exception 'Call Parent is only available during an active confirmed Study Hall';
  end if;

  if v_bk.scheduled_start is null then
    raise exception 'This session is not scheduled yet';
  end if;

  v_open := v_bk.scheduled_start - interval '5 minutes';
  v_close := coalesce(
    v_bk.scheduled_end,
    v_bk.scheduled_start + make_interval(mins => coalesce(v_bk.duration_minutes, 60))
  ) + interval '15 minutes';

  if now() < v_open or now() > v_close then
    raise exception 'Call Parent is only available during the active Study Hall window';
  end if;

  if p_reason is null or p_reason not in (
    'child_unwell', 'refusing_to_work', 'needs_parent_assistance', 'behavior_issue', 'other'
  ) then
    raise exception 'A valid reason is required';
  end if;

  if v_note is not null and char_length(v_note) > 200 then
    raise exception 'Note must be at most 200 characters';
  end if;

  if exists (
    select 1
      from public.parent_escalation_requests e
     where e.booking_id = p_booking
       and e.created_at > now() - interval '5 minutes'
  ) then
    raise exception 'Please wait before requesting parent attention again';
  end if;

  insert into public.parent_escalation_requests (
    booking_id, tutor_id, account_id, reason, note, status
  ) values (
    p_booking, v_bk.tutor_id, v_bk.account_id, p_reason, v_note, 'pending'
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- Complete/update after telephony attempt (Guide who owns the row, or admin, or
-- service_role). Never accepts or returns a phone number.
create or replace function public.complete_parent_escalation(
  p_id uuid,
  p_status text,
  p_outcome text,
  p_call_provider text default null,
  p_call_sid text default null,
  p_call_status text default null,
  p_sms_sid text default null,
  p_sms_status text default null,
  p_error_detail text default null,
  p_call_attempted boolean default false,
  p_sms_attempted boolean default false
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row record;
begin
  select * into v_row from public.parent_escalation_requests where id = p_id;
  if v_row.id is null then
    raise exception 'Escalation not found';
  end if;

  -- service_role has auth.uid() null; allow. Else assigned Guide or admin.
  if v_uid is not null
     and v_uid is distinct from v_row.tutor_id
     and not public.is_admin(v_uid) then
    raise exception 'Not authorized';
  end if;

  if p_status is null or p_status not in (
    'call_placed', 'sms_sent', 'failed', 'not_configured'
  ) then
    raise exception 'Invalid status';
  end if;

  update public.parent_escalation_requests
     set status = p_status,
         outcome = p_outcome,
         call_provider = coalesce(p_call_provider, call_provider),
         call_sid = coalesce(p_call_sid, call_sid),
         call_status = coalesce(p_call_status, call_status),
         sms_sid = coalesce(p_sms_sid, sms_sid),
         sms_status = coalesce(p_sms_status, sms_status),
         error_detail = coalesce(p_error_detail, error_detail),
         call_attempted_at = case when p_call_attempted then coalesce(call_attempted_at, now()) else call_attempted_at end,
         sms_attempted_at = case when p_sms_attempted then coalesce(sms_attempted_at, now()) else sms_attempted_at end,
         completed_at = now()
   where id = p_id
     and status = 'pending';
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.parent_escalation_requests enable row level security;

drop policy if exists per_select on public.parent_escalation_requests;
create policy per_select on public.parent_escalation_requests
  for select to authenticated
  using (
    tutor_id = auth.uid()
    or account_id = auth.uid()
    or public.is_admin(auth.uid())
  );

-- No client INSERT/UPDATE/DELETE — DEFINER RPCs only.
revoke all on public.parent_escalation_requests from public;
grant select on public.parent_escalation_requests to authenticated;
grant all on public.parent_escalation_requests to service_role;

revoke all on function public.set_my_phone(text) from public;
grant execute on function public.set_my_phone(text) to authenticated, service_role;

revoke all on function public.request_parent_escalation(uuid, text, text) from public;
grant execute on function public.request_parent_escalation(uuid, text, text)
  to authenticated, service_role;

revoke all on function public.complete_parent_escalation(
  uuid, text, text, text, text, text, text, text, text, boolean, boolean
) from public;
grant execute on function public.complete_parent_escalation(
  uuid, text, text, text, text, text, text, text, text, boolean, boolean
) to authenticated, service_role;

notify pgrst, 'reload schema';
