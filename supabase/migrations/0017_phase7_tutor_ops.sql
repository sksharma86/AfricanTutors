-- =============================================================================
-- African Tutors — Phase 7: tutor operations (safe tutor-cancellation requests)
-- =============================================================================
-- Tutors cannot perform financial restoration, refunds, courtesy credit, or
-- reassignment (those remain admin-only via Phase 4C). This adds the smallest
-- safe primitive: a tutor may REQUEST to be released from an upcoming session.
-- The request records tutor-side intent + reason and alerts admin (Phase 6); the
-- authoritative resolution (admin_release_booking / admin_reassign_tutor) and all
-- Phase 4 financial rules are unchanged. No tutor earning results from a tutor
-- cancellation. Idempotent migration.
-- =============================================================================

create table if not exists public.tutor_cancellation_requests (
  id          uuid primary key default gen_random_uuid(),
  booking_id  uuid not null references public.bookings (id) on delete cascade,
  tutor_id    uuid not null references public.profiles (id) on delete cascade,
  reason      text,
  status      text not null default 'open' check (status in ('open', 'resolved', 'withdrawn')),
  created_at  timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles (id) on delete set null
);
create index if not exists tcr_tutor_idx on public.tutor_cancellation_requests (tutor_id);
create index if not exists tcr_status_idx on public.tutor_cancellation_requests (status);
-- At most one OPEN request per booking.
create unique index if not exists tcr_active_one_per_booking on public.tutor_cancellation_requests (booking_id) where status = 'open';

-- ---------------------------------------------------------------------------
-- request_tutor_cancellation — the assigned tutor (or admin) flags an upcoming
-- session they can't attend. No financial/booking-state change; admin resolves.
-- ---------------------------------------------------------------------------
create or replace function public.request_tutor_cancellation(p_booking uuid, p_reason text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_bk record; v_id uuid;
begin
  select id, tutor_id, status into v_bk from public.bookings where id = p_booking;
  if v_bk.id is null then raise exception 'Booking not found'; end if;
  if v_bk.tutor_id is null or (v_uid is distinct from v_bk.tutor_id and not public.is_admin(v_uid)) then
    raise exception 'Not authorized to request cancellation for this booking';
  end if;
  if v_bk.status not in ('pending', 'confirmed') then
    raise exception 'Only upcoming (pending/confirmed) sessions can be cancelled';
  end if;
  if coalesce(btrim(p_reason), '') = '' then raise exception 'A reason is required'; end if;
  begin
    insert into public.tutor_cancellation_requests (booking_id, tutor_id, reason)
    values (p_booking, v_bk.tutor_id, p_reason)
    returning id into v_id;
  exception when unique_violation then
    raise exception 'A cancellation request is already open for this session';
  end;
  return v_id;
end;
$$;

-- Admin resolves a specific request (approved/handled or rejected → withdrawn).
create or replace function public.resolve_tutor_cancellation_request(p_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin(auth.uid()) then raise exception 'Not authorized'; end if;
  if p_status not in ('resolved', 'withdrawn') then raise exception 'invalid status'; end if;
  update public.tutor_cancellation_requests
     set status = p_status, resolved_at = now(), resolved_by = auth.uid()
   where id = p_id and status = 'open';
end;
$$;

-- Auto-resolve open requests for a booking (called by admin release/reassign
-- routes after they act). Admin/service only.
create or replace function public.resolve_tutor_cancellation_by_booking(p_booking uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_financial_actor() then raise exception 'Not authorized'; end if;
  update public.tutor_cancellation_requests
     set status = 'resolved', resolved_at = now(), resolved_by = auth.uid()
   where booking_id = p_booking and status = 'open';
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS: a tutor reads their OWN requests; admins read all. No client writes
-- (requests are created/resolved only through the DEFINER functions above).
-- ---------------------------------------------------------------------------
alter table public.tutor_cancellation_requests enable row level security;
drop policy if exists tcr_select on public.tutor_cancellation_requests;
create policy tcr_select on public.tutor_cancellation_requests for select to authenticated
  using (tutor_id = auth.uid() or public.is_admin(auth.uid()));

grant select on public.tutor_cancellation_requests to authenticated;
grant all on public.tutor_cancellation_requests to service_role;

do $$
declare fn text;
begin
  for fn in select unnest(array[
    'request_tutor_cancellation(uuid,text)',
    'resolve_tutor_cancellation_request(uuid,text)',
    'resolve_tutor_cancellation_by_booking(uuid)'
  ]) loop
    execute format('revoke all on function public.%s from public', fn);
    execute format('grant execute on function public.%s to authenticated, service_role', fn);
  end loop;
end $$;

notify pgrst, 'reload schema';
