-- African Tutors — Phase 2: administrator tutor application review
--
-- Provides the first real administrator action: reviewing a tutor
-- application and setting its status to approved/rejected/suspended.
-- This is implemented as a single SECURITY DEFINER function rather than a
-- raw table UPDATE grant so that:
--   1. Authorization is checked in one place (is_admin()), not duplicated
--      across every client call site.
--   2. approved_by / approved_at / status_updated_at are always set
--      correctly and consistently, never forgotten by a caller.
--   3. Regular authenticated users are never granted UPDATE on
--      tutor_profiles.status at all — calling this function is the only
--      way that column changes, and the function itself refuses to run
--      for anyone who isn't an admin.

create or replace function public.admin_set_tutor_status(
  target_tutor_id uuid,
  new_status public.tutor_status,
  note text default null
)
returns public.tutor_profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_row public.tutor_profiles;
begin
  if not public.is_admin() then
    raise exception 'Only administrators can update a tutor application status';
  end if;

  update public.tutor_profiles
  set
    status = new_status,
    admin_notes = coalesce(note, admin_notes),
    approved_by = case when new_status = 'approved' then auth.uid() else approved_by end,
    approved_at = case when new_status = 'approved' then now() else approved_at end,
    status_updated_at = now()
  where id = target_tutor_id
  returning * into updated_row;

  if updated_row.id is null then
    raise exception 'Tutor application not found';
  end if;

  return updated_row;
end;
$$;

comment on function public.admin_set_tutor_status is
  'Admin-only. Approves/rejects/suspends a tutor application. Safe to '
  'GRANT EXECUTE broadly because the function itself enforces is_admin() '
  '— a non-admin caller simply receives an authorization error.';

-- Any authenticated user may attempt to call this function; whether it
-- succeeds is entirely gated by the is_admin() check inside it.
grant execute on function public.admin_set_tutor_status(uuid, public.tutor_status, text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Seed a small starter subject catalog so the tutor application form has
-- real choices. Full subject management tooling is a later phase.
-- ---------------------------------------------------------------------------

insert into public.subjects (name, category) values
  ('Mathematics', 'STEM'),
  ('Physics', 'STEM'),
  ('Chemistry', 'STEM'),
  ('Biology', 'STEM'),
  ('Computer Science', 'STEM'),
  ('English', 'Languages'),
  ('French', 'Languages'),
  ('Economics', 'Social Sciences'),
  ('History', 'Social Sciences'),
  ('Test Prep (SAT / ACT)', 'Test Prep')
on conflict (name) do nothing;
