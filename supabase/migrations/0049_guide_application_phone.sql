-- =============================================================================
-- Guide applications: store WhatsApp on the existing profiles.phone_e164,
-- keep new applicants pending, and block availability until approval.
-- Does not add a status enum value. Does not send WhatsApp or SMS.
-- =============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested text := coalesce(new.raw_user_meta_data ->> 'requested_role', 'student');
  dname     text := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), '');
  v_phone   text := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'phone_e164', '')), '');
begin
  if v_phone is not null and v_phone !~ '^\+[1-9][0-9]{7,14}$' then
    v_phone := null;
  end if;

  insert into public.profiles (id, role, display_name, phone_e164, phone_updated_at)
  values (
    new.id,
    'student',
    dname,
    v_phone,
    case when v_phone is null then null else now() end
  )
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

-- Approved Guides only. Pending and rejected applicants stay role=student.
create or replace function public.is_approved_guide(p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    join public.tutor_profiles tp on tp.profile_id = p.id
    where p.id = p_uid
      and p.role = 'tutor'
      and tp.status = 'approved'
  );
$$;

revoke all on function public.is_approved_guide(uuid) from public;
grant execute on function public.is_approved_guide(uuid) to authenticated, service_role;

drop policy if exists tutor_availability_write on public.tutor_availability;
create policy tutor_availability_write on public.tutor_availability
  for all to authenticated
  using (
    (tutor_id = auth.uid() and public.is_approved_guide(auth.uid()))
    or public.is_admin(auth.uid())
  )
  with check (
    (tutor_id = auth.uid() and public.is_approved_guide(auth.uid()))
    or public.is_admin(auth.uid())
  );

drop policy if exists tutor_exceptions_write on public.tutor_availability_exceptions;
create policy tutor_exceptions_write on public.tutor_availability_exceptions
  for all to authenticated
  using (
    (tutor_id = auth.uid() and public.is_approved_guide(auth.uid()))
    or public.is_admin(auth.uid())
  )
  with check (
    (tutor_id = auth.uid() and public.is_approved_guide(auth.uid()))
    or public.is_admin(auth.uid())
  );
