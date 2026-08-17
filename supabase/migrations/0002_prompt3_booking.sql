-- =============================================================================
-- African Tutors — Prompt 3: Booking, Scheduling, Availability, Matching
-- =============================================================================
-- Additive migration on top of Phase 2 (0001). Adds the managed-booking data
-- model: learners (students), subject catalog, tutor subject approvals, tutor
-- recurring availability + exceptions, and bookings with:
--   * timezone-safe scheduling (authoritative times in UTC / timestamptz)
--   * DB-enforced double-booking prevention (gist exclusion constraint)
--   * DB-enforced one-free-30min-trial per student
--   * managed automatic tutor matching (SECURITY DEFINER)
--   * strict RLS + anti-poaching privacy (no contact info on bookings)
--
-- Idempotent where practical. Does NOT modify Phase 2 auth tables/policies
-- except an additive tutor timezone column.
-- =============================================================================

create extension if not exists btree_gist;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'subject_category') then
    create type public.subject_category as enum
      ('math','science','english_writing','test_prep','college','other');
  end if;
  if not exists (select 1 from pg_type where typname = 'school_level') then
    create type public.school_level as enum ('middle_school','high_school','college');
  end if;
  if not exists (select 1 from pg_type where typname = 'booking_status') then
    create type public.booking_status as enum
      ('pending','confirmed','completed','cancelled','no_show');
  end if;
end
$$;

-- Additive: tutors need an IANA timezone for availability interpretation.
alter table public.tutor_profiles
  add column if not exists timezone text not null default 'Africa/Lagos';

-- ---------------------------------------------------------------------------
-- students — the learners. Parent-first: one account (profiles.id) may own
-- many students (children). The free trial belongs to the STUDENT, not login.
-- ---------------------------------------------------------------------------
create table if not exists public.students (
  id           uuid primary key default gen_random_uuid(),
  account_id   uuid not null references public.profiles (id) on delete cascade,
  full_name    text not null,
  grade_level  text,                       -- '6'..'12' or 'college' (flexible for future expansion)
  school_level public.school_level,
  school_name  text,
  timezone     text not null default 'America/Chicago',
  created_at   timestamptz not null default now()
);
create index if not exists students_account_id_idx on public.students (account_id);
-- Default the owner to the caller so an account can insert its own students
-- under RLS (with check account_id = auth.uid()) without trusting the client.
alter table public.students alter column account_id set default auth.uid();

-- ---------------------------------------------------------------------------
-- subjects — admin-managed catalog.
-- ---------------------------------------------------------------------------
create table if not exists public.subjects (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  category   public.subject_category not null,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- tutor_subjects — which approved tutor may teach which subject. ADMIN owns
-- this list; tutors can never grant themselves subjects.
-- ---------------------------------------------------------------------------
create table if not exists public.tutor_subjects (
  tutor_id    uuid not null references public.profiles (id) on delete cascade,
  subject_id  uuid not null references public.subjects (id) on delete cascade,
  approved_by uuid references public.profiles (id),
  created_at  timestamptz not null default now(),
  primary key (tutor_id, subject_id)
);
create index if not exists tutor_subjects_subject_idx on public.tutor_subjects (subject_id);

-- ---------------------------------------------------------------------------
-- tutor_availability — recurring weekly blocks in the TUTOR's local timezone.
-- day_of_week: 0=Sunday .. 6=Saturday (matches Postgres extract(dow)).
-- ---------------------------------------------------------------------------
create table if not exists public.tutor_availability (
  id          uuid primary key default gen_random_uuid(),
  tutor_id    uuid not null references public.profiles (id) on delete cascade,
  day_of_week int  not null check (day_of_week between 0 and 6),
  start_time  time not null,
  end_time    time not null,
  created_at  timestamptz not null default now(),
  constraint tutor_availability_valid_range check (end_time > start_time),
  constraint tutor_availability_no_dup unique (tutor_id, day_of_week, start_time, end_time)
);
create index if not exists tutor_availability_tutor_idx on public.tutor_availability (tutor_id, day_of_week);

-- ---------------------------------------------------------------------------
-- tutor_availability_exceptions — one-off unavailable windows (UTC).
-- ---------------------------------------------------------------------------
create table if not exists public.tutor_availability_exceptions (
  id         uuid primary key default gen_random_uuid(),
  tutor_id   uuid not null references public.profiles (id) on delete cascade,
  starts_at  timestamptz not null,
  ends_at    timestamptz not null,
  reason     text,
  created_at timestamptz not null default now(),
  constraint tutor_exception_valid_range check (ends_at > starts_at)
);
create index if not exists tutor_exceptions_tutor_idx on public.tutor_availability_exceptions (tutor_id, starts_at);

-- ---------------------------------------------------------------------------
-- bookings — the hub. Authoritative times in UTC. Privacy-safe: NO email,
-- phone, address, or billing anywhere. Only the minimum a tutor needs
-- (student first name + grade) is denormalized so tutors never need to read
-- the students table.
-- ---------------------------------------------------------------------------
create table if not exists public.bookings (
  id                 uuid primary key default gen_random_uuid(),
  public_reference   text not null unique default ('AT-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8))),
  student_id         uuid not null references public.students (id) on delete cascade,
  account_id         uuid not null references public.profiles (id) on delete cascade,
  tutor_id           uuid references public.profiles (id) on delete set null,
  subject_id         uuid references public.subjects (id) on delete set null,
  other_subject_text text,                          -- when the family requests an unlisted subject
  request_note       text,                          -- "what do you need help with" (private, tutor-visible)
  scheduled_start    timestamptz,                   -- UTC; null only for unscheduled "Other" requests
  scheduled_end      timestamptz,
  duration_minutes   int check (duration_minutes in (30, 60)),
  is_free_trial      boolean not null default false,
  price_cents        int not null default 0,
  status             public.booking_status not null default 'confirmed',
  payment_status     text not null default 'not_required',  -- 'not_required' | 'awaiting_payment' | (future Stripe states)
  -- privacy-safe denormalized display fields:
  student_first_name text,
  student_grade      text,
  subject_name       text,
  tutor_display_name text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  completed_at       timestamptz,
  cancelled_at       timestamptz,
  constraint bookings_free_trial_is_30 check (not is_free_trial or duration_minutes = 30),
  constraint bookings_times_consistent check (
    scheduled_start is null
    or (scheduled_end is not null and duration_minutes is not null
        and scheduled_end = scheduled_start + make_interval(mins => duration_minutes))
  )
);
create index if not exists bookings_account_idx on public.bookings (account_id);
create index if not exists bookings_student_idx on public.bookings (student_id);
create index if not exists bookings_tutor_idx on public.bookings (tutor_id, scheduled_start);

-- Double-booking prevention: a tutor cannot have two overlapping active
-- sessions. Enforced atomically at the DB level (handles concurrent attempts).
alter table public.bookings drop constraint if exists bookings_no_tutor_overlap;
alter table public.bookings add constraint bookings_no_tutor_overlap
  exclude using gist (
    tutor_id with =,
    tstzrange(scheduled_start, scheduled_end) with &&
  ) where (tutor_id is not null and scheduled_start is not null
           and status in ('pending','confirmed','completed'));

-- One free 30-min trial per student (non-cancelled). Enforced at DB level so
-- a client cannot repeatedly claim it.
drop index if exists public.bookings_one_free_trial_per_student;
create unique index bookings_one_free_trial_per_student
  on public.bookings (student_id)
  where (is_free_trial and status <> 'cancelled');

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists bookings_touch_updated_at on public.bookings;
create trigger bookings_touch_updated_at before update on public.bookings
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Availability predicate: is a specific tutor free for [p_start, p_end)?
-- Checks recurring availability (in the tutor's tz), exceptions, and existing
-- bookings. SECURITY DEFINER so matching can run regardless of caller RLS.
-- ---------------------------------------------------------------------------
create or replace function public.tutor_is_available(
  p_tutor uuid, p_tz text, p_start timestamptz, p_end timestamptz
) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  v_ls timestamp := p_start at time zone p_tz;   -- local wall-clock start
  v_le timestamp := p_end   at time zone p_tz;   -- local wall-clock end
begin
  if v_ls::date <> v_le::date then
    return false;  -- keep sessions within a single local day for this phase
  end if;
  if not exists (
    select 1 from public.tutor_availability a
    where a.tutor_id = p_tutor
      and a.day_of_week = extract(dow from v_ls)::int
      and a.start_time <= v_ls::time
      and a.end_time   >= v_le::time
  ) then
    return false;
  end if;
  if exists (
    select 1 from public.tutor_availability_exceptions ex
    where ex.tutor_id = p_tutor and ex.starts_at < p_end and ex.ends_at > p_start
  ) then
    return false;
  end if;
  if exists (
    select 1 from public.bookings b
    where b.tutor_id = p_tutor
      and b.status in ('pending','confirmed','completed')
      and b.scheduled_start < p_end and b.scheduled_end > p_start
  ) then
    return false;
  end if;
  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- get_available_slots — union of bookable start times (UTC) across all
-- eligible tutors for a subject + duration within a window. Used by the UI.
-- ---------------------------------------------------------------------------
create or replace function public.get_available_slots(
  p_subject_id uuid, p_duration int, p_from timestamptz, p_to timestamptz
) returns table (slot_start timestamptz)
language sql stable security definer set search_path = public as $$
  with eligible as (
    select tp.profile_id as tutor_id, coalesce(tp.timezone, 'Africa/Lagos') as tz
    from public.tutor_profiles tp
    join public.tutor_subjects ts
      on ts.tutor_id = tp.profile_id and ts.subject_id = p_subject_id
    where tp.status = 'approved'
  ),
  days as (
    select generate_series(
      (p_from at time zone 'UTC')::date - 1,
      (p_to   at time zone 'UTC')::date + 1,
      interval '1 day'
    )::date as d
  ),
  candidates as (
    select e.tutor_id, e.tz,
      (gs.slot_local at time zone e.tz) as start_utc,
      (gs.slot_local at time zone e.tz) + make_interval(mins => p_duration) as end_utc
    from eligible e
    join public.tutor_availability a on a.tutor_id = e.tutor_id
    join days on extract(dow from days.d)::int = a.day_of_week
    join lateral generate_series(
      (days.d + a.start_time)::timestamp,
      (days.d + a.end_time)::timestamp - make_interval(mins => p_duration),
      interval '30 minutes'
    ) as gs(slot_local) on true
  )
  select distinct c.start_utc as slot_start
  from candidates c
  where c.start_utc >= p_from
    and c.end_utc   <= p_to
    and not exists (
      select 1 from public.tutor_availability_exceptions ex
      where ex.tutor_id = c.tutor_id and ex.starts_at < c.end_utc and ex.ends_at > c.start_utc
    )
    and not exists (
      select 1 from public.bookings b
      where b.tutor_id = c.tutor_id
        and b.status in ('pending','confirmed','completed')
        and b.scheduled_start < c.end_utc and b.scheduled_end > c.start_utc
    )
  order by slot_start;
$$;

-- ---------------------------------------------------------------------------
-- has_used_free_trial — a student is ineligible once a non-cancelled free
-- trial booking exists.
-- ---------------------------------------------------------------------------
create or replace function public.has_used_free_trial(p_student uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.bookings b
    where b.student_id = p_student and b.is_free_trial and b.status <> 'cancelled'
  );
$$;

-- ---------------------------------------------------------------------------
-- create_booking — the managed booking + matching entry point. SECURITY
-- DEFINER; authorizes the caller against the student's owning account,
-- enforces free-trial rules and pricing server-side, auto-assigns an eligible
-- tutor (repeat-tutor preference, then least upcoming workload), and relies on
-- the exclusion constraint for concurrency safety.
--
-- Pricing mirrors src/lib/pricing.ts (30=$12, 60=$20, free trial=$0). Keep in
-- sync if pricing changes.
-- ---------------------------------------------------------------------------
create or replace function public.create_booking(
  p_student_id uuid,
  p_subject_id uuid,
  p_other_subject text,
  p_request_note text,
  p_duration int,
  p_start timestamptz,
  p_is_free_trial boolean
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_account uuid;
  v_first_name text;
  v_grade text;
  v_end timestamptz;
  v_price int;
  v_subject_name text;
  v_subject_active boolean;
  v_tutor record;
  v_booking_id uuid;
  v_caller uuid := auth.uid();
begin
  select account_id, split_part(full_name, ' ', 1), grade_level
    into v_account, v_first_name, v_grade
  from public.students where id = p_student_id;
  if v_account is null then
    raise exception 'Student not found';
  end if;
  if v_caller is distinct from v_account and not public.is_admin(v_caller) then
    raise exception 'Not authorized to book for this student';
  end if;

  if p_duration not in (30, 60) then
    raise exception 'Invalid duration';
  end if;

  -- Pricing + free-trial rules (server-authoritative).
  if p_is_free_trial then
    if p_duration <> 30 then
      raise exception 'The free trial is 30 minutes only';
    end if;
    if public.has_used_free_trial(p_student_id) then
      raise exception 'This student has already used their free trial';
    end if;
    v_price := 0;
  else
    v_price := case p_duration when 30 then 1200 when 60 then 2000 end;
  end if;

  -- "Other" (unlisted subject): create an unscheduled request for admin triage.
  if p_subject_id is null then
    if coalesce(btrim(p_other_subject), '') = '' then
      raise exception 'Describe the subject you need help with';
    end if;
    insert into public.bookings (
      student_id, account_id, other_subject_text, request_note, duration_minutes,
      is_free_trial, price_cents, status, payment_status,
      student_first_name, student_grade
    ) values (
      p_student_id, v_account, p_other_subject, p_request_note, p_duration,
      p_is_free_trial, v_price, 'pending',
      case when p_is_free_trial then 'not_required' else 'awaiting_payment' end,
      v_first_name, v_grade
    ) returning id into v_booking_id;
    return v_booking_id;
  end if;

  select name, is_active into v_subject_name, v_subject_active
  from public.subjects where id = p_subject_id;
  if v_subject_name is null then
    raise exception 'Subject not found';
  end if;
  if not v_subject_active then
    raise exception 'Subject is not currently available';
  end if;

  if p_start is null then
    raise exception 'A start time is required';
  end if;
  if p_start < now() then
    raise exception 'Cannot book a time in the past';
  end if;
  v_end := p_start + make_interval(mins => p_duration);

  -- Eligible tutors, ordered by: repeat-tutor preference (prior completed
  -- session with this student), then least upcoming workload, then id.
  for v_tutor in
    select tp.profile_id as tutor_id,
           coalesce(tp.timezone, 'Africa/Lagos') as tz,
           pr.display_name,
           (exists (
              select 1 from public.bookings b2
              where b2.tutor_id = tp.profile_id and b2.student_id = p_student_id
                and b2.status = 'completed'
           )) as is_repeat,
           (select count(*) from public.bookings b3
              where b3.tutor_id = tp.profile_id
                and b3.status in ('pending','confirmed')
                and b3.scheduled_start >= now()) as upcoming_load
    from public.tutor_profiles tp
    join public.tutor_subjects ts on ts.tutor_id = tp.profile_id and ts.subject_id = p_subject_id
    join public.profiles pr on pr.id = tp.profile_id
    where tp.status = 'approved'
    order by is_repeat desc, upcoming_load asc, tp.profile_id asc
  loop
    if public.tutor_is_available(v_tutor.tutor_id, v_tutor.tz, p_start, v_end) then
      begin
        insert into public.bookings (
          student_id, account_id, tutor_id, subject_id, request_note,
          scheduled_start, scheduled_end, duration_minutes, is_free_trial,
          price_cents, status, payment_status,
          student_first_name, student_grade, subject_name, tutor_display_name
        ) values (
          p_student_id, v_account, v_tutor.tutor_id, p_subject_id, p_request_note,
          p_start, v_end, p_duration, p_is_free_trial,
          v_price, 'confirmed',
          case when p_is_free_trial then 'not_required' else 'awaiting_payment' end,
          v_first_name, v_grade, v_subject_name, v_tutor.display_name
        ) returning id into v_booking_id;
        return v_booking_id;
      exception when exclusion_violation then
        -- Tutor was just booked concurrently; try the next eligible tutor.
        continue;
      when unique_violation then
        -- Free-trial uniqueness (or similar) tripped concurrently.
        raise exception 'This student has already used their free trial';
      end;
    end if;
  end loop;

  raise exception 'No tutor is available for that time. Please choose another slot.';
end;
$$;

-- ---------------------------------------------------------------------------
-- cancel_booking — account owner (their bookings) or admin. Conservative:
-- no refund/reschedule policy is implied (owner decision, see DECISIONS.md).
-- ---------------------------------------------------------------------------
create or replace function public.cancel_booking(p_booking uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_account uuid; v_caller uuid := auth.uid();
begin
  select account_id into v_account from public.bookings where id = p_booking;
  if v_account is null then raise exception 'Booking not found'; end if;
  if v_caller is distinct from v_account and not public.is_admin(v_caller) then
    raise exception 'Not authorized';
  end if;
  update public.bookings
    set status = 'cancelled', cancelled_at = now()
    where id = p_booking and status in ('pending','confirmed');
end;
$$;

-- ---------------------------------------------------------------------------
-- set_booking_status — admin-only lifecycle transitions (complete / no_show /
-- confirm). Used for operational management and future conversion analytics.
-- ---------------------------------------------------------------------------
create or replace function public.set_booking_status(p_booking uuid, p_status public.booking_status)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin(auth.uid()) then raise exception 'Not authorized'; end if;
  update public.bookings
    set status = p_status,
        completed_at = case when p_status = 'completed' then now() else completed_at end,
        cancelled_at = case when p_status = 'cancelled' then now() else cancelled_at end
    where id = p_booking;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.students                      enable row level security;
alter table public.subjects                      enable row level security;
alter table public.tutor_subjects                enable row level security;
alter table public.tutor_availability            enable row level security;
alter table public.tutor_availability_exceptions enable row level security;
alter table public.bookings                      enable row level security;

-- students: account owner + admin only. Tutors never read the learner table.
drop policy if exists students_select on public.students;
drop policy if exists students_insert on public.students;
drop policy if exists students_update on public.students;
drop policy if exists students_delete on public.students;
create policy students_select on public.students for select to authenticated
  using (account_id = auth.uid() or public.is_admin(auth.uid()));
create policy students_insert on public.students for insert to authenticated
  with check (account_id = auth.uid());
create policy students_update on public.students for update to authenticated
  using (account_id = auth.uid() or public.is_admin(auth.uid()))
  with check (account_id = auth.uid() or public.is_admin(auth.uid()));
create policy students_delete on public.students for delete to authenticated
  using (public.is_admin(auth.uid()));

-- subjects: everyone can read active subjects; only admins manage.
drop policy if exists subjects_select on public.subjects;
drop policy if exists subjects_admin_write on public.subjects;
create policy subjects_select on public.subjects for select to anon, authenticated
  using (is_active or public.is_admin(auth.uid()));
create policy subjects_admin_write on public.subjects for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- tutor_subjects: tutor reads own; admin manages. Tutors CANNOT write (cannot
-- self-approve subjects).
drop policy if exists tutor_subjects_select on public.tutor_subjects;
drop policy if exists tutor_subjects_admin_write on public.tutor_subjects;
create policy tutor_subjects_select on public.tutor_subjects for select to authenticated
  using (tutor_id = auth.uid() or public.is_admin(auth.uid()));
create policy tutor_subjects_admin_write on public.tutor_subjects for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- tutor_availability: tutor manages own; admin can read/manage.
drop policy if exists tutor_availability_select on public.tutor_availability;
drop policy if exists tutor_availability_write on public.tutor_availability;
create policy tutor_availability_select on public.tutor_availability for select to authenticated
  using (tutor_id = auth.uid() or public.is_admin(auth.uid()));
create policy tutor_availability_write on public.tutor_availability for all to authenticated
  using (tutor_id = auth.uid() or public.is_admin(auth.uid()))
  with check (tutor_id = auth.uid() or public.is_admin(auth.uid()));

-- tutor_availability_exceptions: same ownership model.
drop policy if exists tutor_exceptions_select on public.tutor_availability_exceptions;
drop policy if exists tutor_exceptions_write on public.tutor_availability_exceptions;
create policy tutor_exceptions_select on public.tutor_availability_exceptions for select to authenticated
  using (tutor_id = auth.uid() or public.is_admin(auth.uid()));
create policy tutor_exceptions_write on public.tutor_availability_exceptions for all to authenticated
  using (tutor_id = auth.uid() or public.is_admin(auth.uid()))
  with check (tutor_id = auth.uid() or public.is_admin(auth.uid()));

-- bookings: account owner reads their bookings; assigned tutor reads theirs
-- (privacy-safe denormalized fields only — no contact info exists on the row);
-- admin reads all. Writes go through SECURITY DEFINER functions; admins may
-- also update directly.
drop policy if exists bookings_select on public.bookings;
drop policy if exists bookings_admin_update on public.bookings;
create policy bookings_select on public.bookings for select to authenticated
  using (account_id = auth.uid() or tutor_id = auth.uid() or public.is_admin(auth.uid()));
create policy bookings_admin_update on public.bookings for update to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on public.students to authenticated;
grant select on public.subjects to anon, authenticated;
grant all on public.subjects to authenticated;          -- constrained to admins by RLS
grant select on public.tutor_subjects to authenticated;
grant all on public.tutor_subjects to authenticated;    -- constrained to admins by RLS
grant select, insert, update, delete on public.tutor_availability to authenticated;
grant select, insert, update, delete on public.tutor_availability_exceptions to authenticated;
grant select on public.bookings to authenticated;
grant update on public.bookings to authenticated;        -- constrained to admins by RLS

grant all on public.students, public.subjects, public.tutor_subjects,
             public.tutor_availability, public.tutor_availability_exceptions,
             public.bookings to service_role;

revoke all on function public.create_booking(uuid,uuid,text,text,int,timestamptz,boolean) from public;
grant execute on function public.create_booking(uuid,uuid,text,text,int,timestamptz,boolean) to authenticated, service_role;
grant execute on function public.get_available_slots(uuid,int,timestamptz,timestamptz) to authenticated, service_role;
grant execute on function public.has_used_free_trial(uuid) to authenticated, service_role;
grant execute on function public.tutor_is_available(uuid,text,timestamptz,timestamptz) to authenticated, service_role;
grant execute on function public.cancel_booking(uuid) to authenticated, service_role;
grant execute on function public.set_booking_status(uuid, public.booking_status) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Seed subject catalog (idempotent).
-- ---------------------------------------------------------------------------
insert into public.subjects (name, category) values
  ('Pre-Algebra','math'),('Algebra I','math'),('Algebra II','math'),
  ('Geometry','math'),('Trigonometry','math'),('Precalculus','math'),
  ('Calculus','math'),('Statistics','math'),
  ('Biology','science'),('Chemistry','science'),('Physics','science'),
  ('General Science','science'),
  ('English','english_writing'),('Writing','english_writing'),
  ('Reading Comprehension','english_writing'),('Essay Writing','english_writing'),
  ('SAT','test_prep'),('ACT','test_prep'),
  ('Economics','college')
on conflict (name) do nothing;
