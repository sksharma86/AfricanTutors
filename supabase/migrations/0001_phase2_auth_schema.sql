-- =============================================================================
-- African Tutors — Phase 2: Auth schema, roles, and Row Level Security
-- =============================================================================
-- Implements the design documented in DATABASE.md and ARCHITECTURE.md:
--   * profiles / student_profiles / tutor_profiles
--   * default `student` role granted on signup (never client-chosen)
--   * tutor access gated behind admin approval (tutor_profiles.status)
--   * strict RLS so students cannot read tutor/admin data and tutors cannot
--     read private student data (anti-poaching / privacy).
--
-- This migration is idempotent: it can be applied repeatedly.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type public.user_role as enum ('student', 'tutor', 'admin');
  end if;
  if not exists (select 1 from pg_type where typname = 'tutor_status') then
    create type public.tutor_status as enum ('pending', 'approved', 'suspended');
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- Public, cross-role-safe identity. One row per auth.users id.
-- Deliberately does NOT copy the auth email or any private contact info.
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  role         public.user_role not null default 'student',
  display_name text,
  avatar_url   text,
  created_at   timestamptz not null default now()
);

-- Student-only data. Never readable by tutors.
create table if not exists public.student_profiles (
  profile_id  uuid primary key references public.profiles (id) on delete cascade,
  grade_level text,
  notes       text
);

-- Tutor-only data + application status. Never readable by students.
create table if not exists public.tutor_profiles (
  profile_id  uuid primary key references public.profiles (id) on delete cascade,
  status      public.tutor_status not null default 'pending',
  bio         text,
  credentials text,
  approved_by uuid references public.profiles (id),
  approved_at timestamptz
);

-- ---------------------------------------------------------------------------
-- Helper: is the given user an admin? SECURITY DEFINER so RLS policies can
-- call it without recursion (table owner bypasses RLS inside the function).
-- ---------------------------------------------------------------------------
create or replace function public.is_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p where p.id = uid and p.role = 'admin'
  );
$$;

-- ---------------------------------------------------------------------------
-- Signup handler: create the profile rows for a new auth user.
--   * role is ALWAYS 'student' at signup (never trusts client input).
--   * requested_role = 'tutor' creates a PENDING tutor application; it does
--     not grant tutor access until an admin approves it.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested text := coalesce(new.raw_user_meta_data ->> 'requested_role', 'student');
  dname     text := new.raw_user_meta_data ->> 'display_name';
begin
  insert into public.profiles (id, role, display_name)
  values (new.id, 'student', dname)
  on conflict (id) do nothing;

  if requested = 'tutor' then
    insert into public.tutor_profiles (profile_id, status)
    values (new.id, 'pending')
    on conflict (profile_id) do nothing;
  else
    insert into public.student_profiles (profile_id)
    values (new.id)
    on conflict (profile_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Privilege-escalation guards. Users may edit their own profile fields, but
-- must never be able to change their authoritative role or approve themselves
-- as a tutor. Admin-initiated changes (and server-side SECURITY DEFINER /
-- service-role changes where auth.uid() is null) are allowed.
-- ---------------------------------------------------------------------------
create or replace function public.guard_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role
     and auth.uid() is not null
     and not public.is_admin(auth.uid()) then
    raise exception 'Not authorized to change role';
  end if;
  -- id and created_at are immutable from the client.
  new.id := old.id;
  new.created_at := old.created_at;
  return new;
end;
$$;

drop trigger if exists guard_profiles_update on public.profiles;
create trigger guard_profiles_update
  before update on public.profiles
  for each row execute function public.guard_profile_privileges();

create or replace function public.guard_tutor_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.status is distinct from old.status
      or new.approved_by is distinct from old.approved_by
      or new.approved_at is distinct from old.approved_at)
     and auth.uid() is not null
     and not public.is_admin(auth.uid()) then
    raise exception 'Not authorized to change tutor approval state';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_tutor_profiles_update on public.tutor_profiles;
create trigger guard_tutor_profiles_update
  before update on public.tutor_profiles
  for each row execute function public.guard_tutor_privileges();

-- ---------------------------------------------------------------------------
-- Admin actions (SECURITY DEFINER, admin-only). Exposed via PostgREST RPC.
-- ---------------------------------------------------------------------------
create or replace function public.approve_tutor(target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Not authorized';
  end if;

  update public.tutor_profiles
     set status = 'approved', approved_by = auth.uid(), approved_at = now()
   where profile_id = target;

  if not found then
    raise exception 'No tutor application found for %', target;
  end if;

  update public.profiles set role = 'tutor' where id = target;
end;
$$;

create or replace function public.suspend_tutor(target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Not authorized';
  end if;

  update public.tutor_profiles set status = 'suspended' where profile_id = target;
  -- Revoke effective tutor access; the application record is retained.
  update public.profiles set role = 'student' where id = target;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles         enable row level security;
alter table public.student_profiles enable row level security;
alter table public.tutor_profiles   enable row level security;

-- profiles ------------------------------------------------------------------
drop policy if exists profiles_select_own   on public.profiles;
drop policy if exists profiles_select_admin on public.profiles;
drop policy if exists profiles_update_own   on public.profiles;
drop policy if exists profiles_update_admin on public.profiles;

create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = auth.uid());

create policy profiles_select_admin on public.profiles
  for select to authenticated
  using (public.is_admin(auth.uid()));

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy profiles_update_admin on public.profiles
  for update to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- student_profiles ----------------------------------------------------------
drop policy if exists student_profiles_select_own   on public.student_profiles;
drop policy if exists student_profiles_select_admin on public.student_profiles;
drop policy if exists student_profiles_update_own   on public.student_profiles;
drop policy if exists student_profiles_update_admin on public.student_profiles;

create policy student_profiles_select_own on public.student_profiles
  for select to authenticated
  using (profile_id = auth.uid());

create policy student_profiles_select_admin on public.student_profiles
  for select to authenticated
  using (public.is_admin(auth.uid()));

create policy student_profiles_update_own on public.student_profiles
  for update to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

create policy student_profiles_update_admin on public.student_profiles
  for update to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- tutor_profiles ------------------------------------------------------------
drop policy if exists tutor_profiles_select_own   on public.tutor_profiles;
drop policy if exists tutor_profiles_select_admin on public.tutor_profiles;
drop policy if exists tutor_profiles_update_own   on public.tutor_profiles;
drop policy if exists tutor_profiles_update_admin on public.tutor_profiles;

create policy tutor_profiles_select_own on public.tutor_profiles
  for select to authenticated
  using (profile_id = auth.uid());

create policy tutor_profiles_select_admin on public.tutor_profiles
  for select to authenticated
  using (public.is_admin(auth.uid()));

create policy tutor_profiles_update_own on public.tutor_profiles
  for update to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

create policy tutor_profiles_update_admin on public.tutor_profiles
  for update to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- ---------------------------------------------------------------------------
-- Grants. Only authenticated users get table access (further constrained by
-- RLS above). anon gets nothing. Inserts/deletes happen only through the
-- SECURITY DEFINER signup trigger, never directly from clients.
-- ---------------------------------------------------------------------------
revoke all on public.profiles         from anon;
revoke all on public.student_profiles from anon;
revoke all on public.tutor_profiles   from anon;

grant select, update on public.profiles         to authenticated;
grant select, update on public.student_profiles to authenticated;
grant select, update on public.tutor_profiles   to authenticated;

-- The service role bypasses RLS but still needs table privileges for
-- server-side/admin operations.
grant all on public.profiles         to service_role;
grant all on public.student_profiles to service_role;
grant all on public.tutor_profiles   to service_role;

revoke all on function public.approve_tutor(uuid) from public;
revoke all on function public.suspend_tutor(uuid) from public;
grant execute on function public.approve_tutor(uuid) to authenticated, service_role;
grant execute on function public.suspend_tutor(uuid) to authenticated, service_role;
grant execute on function public.is_admin(uuid)      to authenticated, service_role;
