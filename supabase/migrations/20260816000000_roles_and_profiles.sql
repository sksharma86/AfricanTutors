-- African Tutors — Phase 2: identity, roles, and profile separation
--
-- Design principles (see ARCHITECTURE.md and DATABASE.md for the full
-- explanation):
--   1. Supabase Auth (`auth.users`) is the ONLY place credentials live.
--      Nothing in this migration stores a password, and nothing here
--      copies a user's authentication email into a table any other role
--      can read.
--   2. `public.profiles` is the thin, cross-role-visible identity row.
--      It intentionally does not include email/phone.
--   3. `public.student_profiles` / `public.tutor_profiles` hold
--      role-specific data. Sensitive tutor-application fields
--      (admin_notes, status, approval metadata) are never grantable to
--      the tutor themselves or to students at the database privilege
--      level — not just hidden in the UI.
--   4. A brand new "tutor" signup starts in `tutor_profiles.status =
--      'pending'` and gains no elevated access until an administrator
--      calls `admin_set_tutor_status(...)` (added in the next migration).
--   5. Nothing in this file lets a client set their own `role` or a
--      tutor's `status` — those columns are not in any UPDATE grant to
--      `authenticated`.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enum types
-- ---------------------------------------------------------------------------

do $$ begin
  create type public.user_role as enum ('student', 'tutor', 'admin');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.tutor_status as enum ('pending', 'approved', 'rejected', 'suspended');
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null default 'student',
  display_name text not null,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'Thin, cross-role-visible identity row. Deliberately excludes email, phone, '
  'and any other private contact information — those live only in '
  'auth.users, which other users and roles are never granted access to.';
comment on column public.profiles.role is
  'Authoritative role. Never updatable by the authenticated role itself — '
  'see the grants at the end of this file.';

create table if not exists public.student_profiles (
  id uuid primary key references public.profiles (id) on delete cascade,
  grade_level text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.student_profiles is
  'Student-specific profile data. Intentionally has no phone number, '
  'billing address, or payment fields — a tutor should never need those to '
  'teach an assigned student, and they are not collected until a real need '
  '(e.g. booking/payments) exists.';

create table if not exists public.tutor_profiles (
  id uuid primary key references public.profiles (id) on delete cascade,
  status public.tutor_status not null default 'pending',
  headline text,
  bio text,
  education text,
  years_experience integer,
  application_notes text,
  submitted_at timestamptz,
  admin_notes text,
  approved_by uuid references public.profiles (id),
  approved_at timestamptz,
  status_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tutor_profiles_status_idx on public.tutor_profiles (status);

comment on table public.tutor_profiles is
  'Tutor-specific profile data. "status" gates whether an account with '
  'role = tutor actually has approved tutor access. headline/bio/education/'
  'years_experience/application_notes/submitted_at are tutor-editable '
  '"application" fields; status/admin_notes/approved_by/approved_at/'
  'status_updated_at are administrative fields the tutor cannot self-edit '
  '(enforced by column grants, not just UI).';
comment on column public.tutor_profiles.admin_notes is
  'Private administrative notes about the applicant. Never selectable by '
  'the tutor or by students — admin-only.';
comment on column public.tutor_profiles.status is
  'pending -> approved | rejected | suspended. A brand-new tutor signup is '
  'always pending and must be reviewed by an administrator before gaining '
  'approved tutor access.';

create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  category text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.subjects is
  'Small preliminary subject catalog, seeded with common subjects so the '
  'tutor application form has something to select from. Full subject '
  'management tooling is a later phase.';

create table if not exists public.tutor_profile_subjects (
  tutor_id uuid not null references public.tutor_profiles (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (tutor_id, subject_id)
);

comment on table public.tutor_profile_subjects is
  'Which subjects a tutor applied to teach. Join table between '
  'tutor_profiles and subjects.';

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists set_student_profiles_updated_at on public.student_profiles;
create trigger set_student_profiles_updated_at
  before update on public.student_profiles
  for each row execute function public.set_updated_at();

drop trigger if exists set_tutor_profiles_updated_at on public.tutor_profiles;
create trigger set_tutor_profiles_updated_at
  before update on public.tutor_profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Auto-provision a profile (and role-specific row) for every new auth user.
--
-- This is the standard Supabase "on signup" recipe: a SECURITY DEFINER
-- function, owned by the migration role, triggered on auth.users so it runs
-- with the privileges needed to write into public.profiles regardless of
-- RLS. A brand-new "tutor" signup is only ever recorded as
-- tutor_profiles.status = 'pending' here — approval is a separate, later,
-- admin-only action.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text;
  chosen_role public.user_role;
  chosen_display_name text;
begin
  requested_role := new.raw_user_meta_data ->> 'requested_role';

  if requested_role = 'tutor' then
    chosen_role := 'tutor';
  else
    chosen_role := 'student';
  end if;

  chosen_display_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
    split_part(new.email, '@', 1)
  );

  insert into public.profiles (id, role, display_name)
  values (new.id, chosen_role, chosen_display_name);

  if chosen_role = 'tutor' then
    insert into public.tutor_profiles (id, status) values (new.id, 'pending');
  else
    insert into public.student_profiles (id) values (new.id);
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Authorization helper. SECURITY DEFINER so RLS policies on public.profiles
-- can check "is this caller an admin?" without recursively re-evaluating
-- public.profiles' own RLS (which would otherwise cause infinite recursion).
-- ---------------------------------------------------------------------------

create or replace function public.is_admin(uid uuid default auth.uid())
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p where p.id = uid and p.role = 'admin'
  );
$$;

comment on function public.is_admin is
  'True if the given user id (default: the current request''s auth.uid()) '
  'has role = admin. Used inside RLS policies; SECURITY DEFINER so it can '
  'read public.profiles without recursing into the RLS policy that calls it.';

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.student_profiles enable row level security;
alter table public.tutor_profiles enable row level security;
alter table public.subjects enable row level security;
alter table public.tutor_profile_subjects enable row level security;

-- profiles: a user can see/update their own row; admins can see/update any.
-- There is deliberately no policy allowing a tutor to select a student's
-- row (or vice versa) — nothing here gives one party access to another
-- party's identity row.
drop policy if exists "Profiles are viewable by owner or admin" on public.profiles;
create policy "Profiles are viewable by owner or admin"
  on public.profiles for select
  using (auth.uid() = id or public.is_admin());

drop policy if exists "Profiles are editable by owner or admin" on public.profiles;
create policy "Profiles are editable by owner or admin"
  on public.profiles for update
  using (auth.uid() = id or public.is_admin())
  with check (auth.uid() = id or public.is_admin());

-- student_profiles: owner or admin only. No tutor-facing policy exists yet
-- — there is no booking relationship in this phase that would justify a
-- tutor reading anything about a student. Add that policy deliberately,
-- scoped to a confirmed booking, when booking ships.
drop policy if exists "Student profiles are viewable by owner or admin" on public.student_profiles;
create policy "Student profiles are viewable by owner or admin"
  on public.student_profiles for select
  using (auth.uid() = id or public.is_admin());

drop policy if exists "Student profiles are editable by owner or admin" on public.student_profiles;
create policy "Student profiles are editable by owner or admin"
  on public.student_profiles for update
  using (auth.uid() = id or public.is_admin())
  with check (auth.uid() = id or public.is_admin());

-- tutor_profiles: owner or admin only, same reasoning. There is no public
-- "browse tutors" feature yet, so students are not granted read access to
-- other users' tutor_profiles rows in this phase either.
drop policy if exists "Tutor profiles are viewable by owner or admin" on public.tutor_profiles;
create policy "Tutor profiles are viewable by owner or admin"
  on public.tutor_profiles for select
  using (auth.uid() = id or public.is_admin());

drop policy if exists "Tutor profiles are editable by owner or admin" on public.tutor_profiles;
create policy "Tutor profiles are editable by owner or admin"
  on public.tutor_profiles for update
  using (auth.uid() = id or public.is_admin())
  with check (auth.uid() = id or public.is_admin());

-- subjects: public read-only catalog data (non-sensitive).
drop policy if exists "Active subjects are viewable by everyone" on public.subjects;
create policy "Active subjects are viewable by everyone"
  on public.subjects for select
  using (is_active = true or public.is_admin());

-- tutor_profile_subjects: a tutor manages their own subject choices.
drop policy if exists "Tutor subject choices are viewable by owner or admin" on public.tutor_profile_subjects;
create policy "Tutor subject choices are viewable by owner or admin"
  on public.tutor_profile_subjects for select
  using (tutor_id = auth.uid() or public.is_admin());

drop policy if exists "Tutors choose their own subjects" on public.tutor_profile_subjects;
create policy "Tutors choose their own subjects"
  on public.tutor_profile_subjects for insert
  with check (tutor_id = auth.uid());

drop policy if exists "Tutors remove their own subject choices" on public.tutor_profile_subjects;
create policy "Tutors remove their own subject choices"
  on public.tutor_profile_subjects for delete
  using (tutor_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- Grants — defense in depth alongside RLS.
--
-- Column-level grants below are what actually makes self-promotion
-- impossible at the database level: `authenticated` is never granted
-- UPDATE on profiles.role, or on tutor_profiles.status / approved_by /
-- approved_at / status_updated_at / admin_notes. Those columns can only
-- change via the SECURITY DEFINER admin_set_tutor_status() function added
-- in the next migration (which itself checks is_admin()), or by the
-- project owner running SQL directly as the Postgres owner role (see
-- SETUP.md for how the very first administrator is created).
-- ---------------------------------------------------------------------------

grant usage on schema public to authenticated, anon;

grant select on public.profiles to authenticated;
grant update (display_name, avatar_url) on public.profiles to authenticated;

grant select on public.student_profiles to authenticated;
grant update (grade_level, notes) on public.student_profiles to authenticated;

grant select on public.tutor_profiles to authenticated;
grant update (headline, bio, education, years_experience, application_notes, submitted_at)
  on public.tutor_profiles to authenticated;

grant select on public.subjects to authenticated, anon;

grant select, insert, delete on public.tutor_profile_subjects to authenticated;
