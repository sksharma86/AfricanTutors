-- Phase 8: let a customer read the STATUS of their own reported issues.
--
-- Disputes remain admin-read-only under RLS (no customer SELECT policy). To show
-- a polished "Received / Under review / Resolved" badge on session history without
-- exposing complaint text, admin notes, resolutions, or financial actions, we add
-- a SECURITY DEFINER function that returns only (booking_id, status) for disputes
-- owned by the calling account. This does not weaken authorization or expose any
-- new sensitive data; it is strict data minimization.

create or replace function public.list_my_dispute_statuses()
returns table (booking_id uuid, status text)
language sql
stable
security definer
set search_path to 'public'
as $$
  select d.booking_id, d.status
  from public.disputes d
  where d.account_id = auth.uid();
$$;

revoke all on function public.list_my_dispute_statuses() from public;
grant execute on function public.list_my_dispute_statuses() to authenticated, service_role;
