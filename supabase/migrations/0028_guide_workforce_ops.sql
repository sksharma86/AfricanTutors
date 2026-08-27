-- =============================================================================
-- Study Hall (at home) — Guide workforce ops + pending-applicant RPC guards
-- =============================================================================
-- 1) Pending / rejected / suspended Guide-applicant accounts cannot call
--    book_session or purchase_package as a parent. Ordinary parents unchanged.
--    Booking and package math stay in the existing inner functions.
-- 2) reject_tutor: admin-only rejection of a pending applicant (status becomes
--    suspended with approved_at left null — derived "rejected" in the app).
-- 3) suspend_tutor: only an approved Guide; still no hard-delete.
-- Do not apply to Production until reviewed. Idempotent where possible.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Applicant account detector (role stays student until approve_tutor).
-- ---------------------------------------------------------------------------
create or replace function public.is_guide_applicant_account(p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tutor_profiles tp
    join public.profiles p on p.id = tp.profile_id
    where tp.profile_id = p_uid
      and tp.status in ('pending', 'suspended')
      and p.role is distinct from 'tutor'
      and p.role is distinct from 'admin'
  );
$$;

revoke all on function public.is_guide_applicant_account(uuid) from public;
grant execute on function public.is_guide_applicant_account(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Wrap book_session / purchase_package without rewriting payment math.
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regprocedure('public.book_session_unchecked(uuid,uuid,text,text,integer,timestamptz,boolean)') is null
     and to_regprocedure('public.book_session(uuid,uuid,text,text,integer,timestamptz,boolean)') is not null
  then
    alter function public.book_session(uuid, uuid, text, text, integer, timestamptz, boolean)
      rename to book_session_unchecked;
  end if;
end
$$;

do $$
begin
  if to_regprocedure('public.book_session_unchecked(uuid,uuid,text,text,integer,timestamptz,boolean)') is null then
    raise exception '0028 refused to replace book_session: inner function missing';
  end if;
end
$$;

create or replace function public.book_session(
  p_student_id uuid,
  p_subject_id uuid,
  p_other_subject text,
  p_request_note text,
  p_duration integer,
  p_start timestamp with time zone,
  p_is_free_trial boolean
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null
     and not public.is_admin(auth.uid())
     and public.is_guide_applicant_account(auth.uid()) then
    raise exception 'Guide application accounts cannot book Study Hall as a parent';
  end if;
  return public.book_session_unchecked(
    p_student_id, p_subject_id, p_other_subject, p_request_note, p_duration, p_start, p_is_free_trial
  );
end;
$$;

revoke all on function public.book_session_unchecked(uuid, uuid, text, text, integer, timestamp with time zone, boolean) from public;
revoke all on function public.book_session_unchecked(uuid, uuid, text, text, integer, timestamp with time zone, boolean) from anon, authenticated;
grant execute on function public.book_session(uuid, uuid, text, text, integer, timestamp with time zone, boolean)
  to authenticated, service_role;

do $$
begin
  if to_regprocedure('public.purchase_package_unchecked(uuid,uuid)') is null
     and to_regprocedure('public.purchase_package(uuid,uuid)') is not null
  then
    alter function public.purchase_package(uuid, uuid)
      rename to purchase_package_unchecked;
  end if;
end
$$;

do $$
begin
  if to_regprocedure('public.purchase_package_unchecked(uuid,uuid)') is null then
    raise exception '0028 refused to replace purchase_package: inner function missing';
  end if;
end
$$;

create or replace function public.purchase_package(p_package_id uuid, p_account uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null
     and not public.is_admin(auth.uid())
     and public.is_guide_applicant_account(auth.uid()) then
    raise exception 'Guide application accounts cannot purchase hours as a parent';
  end if;
  return public.purchase_package_unchecked(p_package_id, p_account);
end;
$$;

revoke all on function public.purchase_package_unchecked(uuid, uuid) from public;
revoke all on function public.purchase_package_unchecked(uuid, uuid) from anon, authenticated;
grant execute on function public.purchase_package(uuid, uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Reject a pending applicant. Uses existing tutor_status: suspended + no
-- approved_at means "rejected" (never granted Guide access).
-- ---------------------------------------------------------------------------
create or replace function public.reject_tutor(target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status public.tutor_status;
  v_approved_at timestamptz;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Not authorized';
  end if;

  select status, approved_at
    into v_status, v_approved_at
    from public.tutor_profiles
   where profile_id = target;

  if v_status is null then
    raise exception 'No Guide application found';
  end if;
  if v_status is distinct from 'pending' then
    raise exception 'Only a pending Guide application can be rejected';
  end if;

  update public.tutor_profiles
     set status = 'suspended'
   where profile_id = target;

  -- Role remains student. Do not set approved_at.
  update public.profiles
     set role = 'student'
   where id = target;

  perform public.log_admin_action(
    'reject_tutor',
    'tutor_profiles',
    target,
    jsonb_build_object('status', v_status::text, 'approved_at', v_approved_at),
    jsonb_build_object('status', 'suspended', 'outcome', 'rejected'),
    'Guide application rejected'
  );
end;
$$;

revoke all on function public.reject_tutor(uuid) from public;
grant execute on function public.reject_tutor(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Suspend an active Guide only (reactivation remains approve_tutor).
-- ---------------------------------------------------------------------------
create or replace function public.suspend_tutor(target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status public.tutor_status;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Not authorized';
  end if;

  select status into v_status
    from public.tutor_profiles
   where profile_id = target;

  if v_status is null then
    raise exception 'No Guide profile found';
  end if;
  if v_status is distinct from 'approved' then
    raise exception 'Only an active Guide can be suspended';
  end if;

  update public.tutor_profiles set status = 'suspended' where profile_id = target;
  update public.profiles set role = 'student' where id = target;

  perform public.log_admin_action(
    'suspend_tutor',
    'tutor_profiles',
    target,
    jsonb_build_object('status', 'approved'),
    jsonb_build_object('status', 'suspended'),
    'Guide suspended — unavailable for new assignments'
  );
end;
$$;

notify pgrst, 'reload schema';
