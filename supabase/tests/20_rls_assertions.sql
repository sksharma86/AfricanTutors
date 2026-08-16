-- Automated Row Level Security / privilege assertions for African Tutors.
--
-- Each test SET ROLEs to the same role PostgREST/Supabase would use for a
-- request (`authenticated` or `anon`) and sets `request.jwt.claims` the
-- same way Supabase's API gateway does, so these assertions exercise the
-- exact policies and grants that will run in production — not a
-- reimplementation of them.
--
-- Run with: psql -v ON_ERROR_STOP=1 -f 20_rls_assertions.sql
-- Every test either raises 'PASS: ...' as a NOTICE or raises an exception
-- starting with 'FAIL:' — a FAIL aborts the whole script with a nonzero
-- exit code.
--
-- Note: psql does not perform ":var" interpolation inside dollar-quoted
-- (`do $$ ... $$`) blocks, so fixture ids are passed in via custom GUCs
-- (`app.*`) set once below, then read inside PL/pgSQL with
-- current_setting('app.xxx')::uuid.

set client_min_messages = notice;

\set alice 00000000-0000-0000-0000-000000000001
\set bob 00000000-0000-0000-0000-000000000002
\set carol 00000000-0000-0000-0000-000000000003
\set dave 00000000-0000-0000-0000-000000000004
\set eve 00000000-0000-0000-0000-000000000005

select set_config('app.alice', :'alice', false);
select set_config('app.bob', :'bob', false);
select set_config('app.carol', :'carol', false);
select set_config('app.dave', :'dave', false);
select set_config('app.eve', :'eve', false);

-- ---------------------------------------------------------------------------
-- 1. A student can read their own profile.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :'alice'), false);
set role authenticated;
do $$
declare
  seen_name text;
begin
  select display_name into seen_name from public.profiles where id = current_setting('app.alice')::uuid;
  if seen_name is distinct from 'Alice' then
    raise exception 'FAIL: student could not read their own profile (got %)', seen_name;
  end if;
  raise notice 'PASS: student can read their own profile';
end $$;
reset role;
reset request.jwt.claims;

-- ---------------------------------------------------------------------------
-- 2. A student CANNOT read another student's profile row at all.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :'alice'), false);
set role authenticated;
do $$
declare
  row_count int;
begin
  select count(*) into row_count from public.profiles where id = current_setting('app.bob')::uuid;
  if row_count <> 0 then
    raise exception 'FAIL: student could read another student''s profile';
  end if;
  raise notice 'PASS: student cannot read another student''s profile';
end $$;
reset role;
reset request.jwt.claims;

-- ---------------------------------------------------------------------------
-- 3. THE CORE ANTI-POACHING TEST: an approved tutor cannot read a
--    student's profile or student_profiles row at all, just by virtue of
--    being an approved, active tutor on the platform.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :'carol'), false);
set role authenticated;
do $$
declare
  profile_count int;
  student_profile_count int;
begin
  select count(*) into profile_count
    from public.profiles
    where id in (current_setting('app.alice')::uuid, current_setting('app.bob')::uuid);
  select count(*) into student_profile_count
    from public.student_profiles
    where id in (current_setting('app.alice')::uuid, current_setting('app.bob')::uuid);

  if profile_count <> 0 then
    raise exception 'FAIL: approved tutor could read a student profile row';
  end if;
  if student_profile_count <> 0 then
    raise exception 'FAIL: approved tutor could read a student_profiles row';
  end if;

  raise notice 'PASS: approved tutor cannot read any student profile data';
end $$;
reset role;
reset request.jwt.claims;

-- ---------------------------------------------------------------------------
-- 4. THE MIRROR ANTI-POACHING TEST: a student cannot read a tutor's
--    private tutor_profiles row (application notes, admin notes, etc.)
--    In this phase there is no "approved tutor directory" yet, so
--    students have no visibility into tutor_profiles at all.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :'alice'), false);
set role authenticated;
do $$
declare
  row_count int;
begin
  select count(*) into row_count
    from public.tutor_profiles
    where id in (current_setting('app.carol')::uuid, current_setting('app.dave')::uuid);
  if row_count <> 0 then
    raise exception 'FAIL: student could read a tutor_profiles row';
  end if;
  raise notice 'PASS: student cannot read tutor_profiles data';
end $$;
reset role;
reset request.jwt.claims;

-- ---------------------------------------------------------------------------
-- 5. THE DEEPEST ANTI-POACHING TEST: nobody but service_role can query
--    auth.users at all — so even if every RLS policy above were somehow
--    misconfigured, a tutor still has no path to a student's
--    authentication email (or vice versa), because auth.users itself is
--    not exposed to the authenticated or anon roles.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :'carol'), false);
set role authenticated;
do $$
begin
  begin
    perform email from auth.users where id = current_setting('app.alice')::uuid;
    raise exception 'FAIL: tutor could query auth.users directly for a student''s email';
  exception
    when insufficient_privilege then
      raise notice 'PASS: auth.users is not queryable by the authenticated role';
  end;
end $$;
reset role;
reset request.jwt.claims;

-- ---------------------------------------------------------------------------
-- 6. A pending tutor cannot approve themselves via the admin function.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :'dave'), false);
set role authenticated;
do $$
begin
  begin
    perform public.admin_set_tutor_status(current_setting('app.dave')::uuid, 'approved', 'self-approval attempt');
    raise exception 'FAIL: a non-admin tutor was able to approve themselves';
  exception
    when others then
      if sqlerrm like 'Only administrators%' then
        raise notice 'PASS: a pending tutor cannot approve themselves (%)', sqlerrm;
      else
        raise;
      end if;
  end;
end $$;
reset role;
reset request.jwt.claims;

-- ---------------------------------------------------------------------------
-- 7. A tutor cannot directly UPDATE their own status column, even though
--    they can update their own bio/education (column-level grants, not
--    just RLS, block this).
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :'dave'), false);
set role authenticated;
do $$
begin
  begin
    update public.tutor_profiles set status = 'approved' where id = current_setting('app.dave')::uuid;
    raise exception 'FAIL: tutor was able to update their own status column directly';
  exception
    when insufficient_privilege then
      raise notice 'PASS: tutor has no UPDATE grant on tutor_profiles.status';
  end;
end $$;
reset role;
reset request.jwt.claims;

-- A tutor CAN update their own application fields (bio, education, etc).
select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :'dave'), false);
set role authenticated;
do $$
declare
  seen_bio text;
begin
  update public.tutor_profiles set bio = 'Experienced maths tutor.' where id = current_setting('app.dave')::uuid;
  select bio into seen_bio from public.tutor_profiles where id = current_setting('app.dave')::uuid;
  if seen_bio is distinct from 'Experienced maths tutor.' then
    raise exception 'FAIL: tutor could not update their own bio';
  end if;
  raise notice 'PASS: tutor can update their own application fields (bio, etc.)';
end $$;
reset role;
reset request.jwt.claims;

-- ---------------------------------------------------------------------------
-- 8. A student cannot change their own role column, even to something
--    harmless-looking — the column simply isn't grantable to them.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :'alice'), false);
set role authenticated;
do $$
begin
  begin
    update public.profiles set role = 'admin' where id = current_setting('app.alice')::uuid;
    raise exception 'FAIL: student was able to change their own role';
  exception
    when insufficient_privilege then
      raise notice 'PASS: student has no UPDATE grant on profiles.role';
  end;
end $$;
reset role;
reset request.jwt.claims;

-- ---------------------------------------------------------------------------
-- 9. An administrator CAN see tutor applications and approve/reject them,
--    and CAN see student/tutor profiles for legitimate admin purposes.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :'eve'), false);
set role authenticated;
do $$
declare
  pending_count int;
  dave_status public.tutor_status;
begin
  select count(*) into pending_count from public.tutor_profiles where status = 'pending';
  if pending_count < 1 then
    raise exception 'FAIL: admin could not see pending tutor applications';
  end if;

  perform public.admin_set_tutor_status(
    current_setting('app.dave')::uuid,
    'rejected',
    'Not enough teaching experience yet.'
  );
  select status into dave_status from public.tutor_profiles where id = current_setting('app.dave')::uuid;
  if dave_status <> 'rejected' then
    raise exception 'FAIL: admin rejection of a tutor application did not take effect';
  end if;

  raise notice 'PASS: admin can review and act on tutor applications';
end $$;
reset role;
reset request.jwt.claims;

-- ---------------------------------------------------------------------------
-- 10. Carol was approved via the admin function in fixtures — confirm her
--     tutor status actually reflects that, and that she (as herself) can
--     see it.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :'carol'), false);
set role authenticated;
do $$
declare
  carol_status public.tutor_status;
begin
  select status into carol_status from public.tutor_profiles where id = current_setting('app.carol')::uuid;
  if carol_status <> 'approved' then
    raise exception 'FAIL: approved tutor does not see their own approved status (got %)', carol_status;
  end if;
  raise notice 'PASS: approved tutor sees their own approved status';
end $$;
reset role;
reset request.jwt.claims;

-- ---------------------------------------------------------------------------
-- 11. Logged-out (anon) requests cannot read any profile data at all, but
--     CAN read the public subject catalog.
-- ---------------------------------------------------------------------------
set role anon;
do $$
begin
  begin
    perform count(*) from public.profiles;
    raise exception 'FAIL: anon could query public.profiles';
  exception
    when insufficient_privilege then
      raise notice 'PASS: anon has no access to public.profiles';
  end;
end $$;
do $$
declare
  subject_count int;
begin
  select count(*) into subject_count from public.subjects where is_active = true;
  if subject_count < 1 then
    raise exception 'FAIL: anon could not read the public subject catalog';
  end if;
  raise notice 'PASS: anon can read the public subject catalog (% subjects)', subject_count;
end $$;
reset role;

-- ---------------------------------------------------------------------------
-- 12. A tutor can choose their own teaching subjects but not another
--     tutor's.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :'carol'), false);
set role authenticated;
do $$
declare
  a_subject uuid;
begin
  select id into a_subject from public.subjects where name = 'Mathematics';
  insert into public.tutor_profile_subjects (tutor_id, subject_id)
    values (current_setting('app.carol')::uuid, a_subject);
  raise notice 'PASS: tutor can add their own subject choice';
end $$;
do $$
declare
  a_subject uuid;
begin
  select id into a_subject from public.subjects where name = 'Physics';
  begin
    insert into public.tutor_profile_subjects (tutor_id, subject_id)
      values (current_setting('app.dave')::uuid, a_subject);
    raise exception 'FAIL: tutor could add a subject choice for another tutor';
  exception
    when insufficient_privilege or check_violation then
      raise notice 'PASS: tutor cannot add a subject choice for another tutor';
  end;
end $$;
reset role;
reset request.jwt.claims;

\echo 'ALL RLS ASSERTIONS PASSED'
