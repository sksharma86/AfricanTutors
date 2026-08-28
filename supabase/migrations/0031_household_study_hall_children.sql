-- Household Study Hall: 1–3 children on ONE booking.
-- Additive. Existing bookings keep student_id as the primary child.
-- Price, compensation, Daily room, and cancellation remain per booking / duration.

-- ---------------------------------------------------------------------------
-- Columns on bookings (display + count; source of truth is booking_children)
-- ---------------------------------------------------------------------------
alter table public.bookings
  add column if not exists student_first_names text[],
  add column if not exists child_count integer not null default 1;

update public.bookings
   set student_first_names = array[student_first_name]
 where student_first_names is null
   and student_first_name is not null;

update public.bookings
   set child_count = 1
 where child_count is null or child_count < 1;

alter table public.bookings
  add constraint bookings_child_count_range check (child_count between 1 and 3);

-- ---------------------------------------------------------------------------
-- booking_children
-- ---------------------------------------------------------------------------
create table if not exists public.booking_children (
  booking_id uuid not null references public.bookings(id) on delete cascade,
  student_id uuid not null references public.students(id),
  sort_order smallint not null default 1,
  created_at timestamptz not null default now(),
  primary key (booking_id, student_id),
  constraint booking_children_sort_range check (sort_order between 1 and 3)
);

create unique index if not exists booking_children_booking_sort_uidx
  on public.booking_children (booking_id, sort_order);

create index if not exists booking_children_student_idx
  on public.booking_children (student_id);

insert into public.booking_children (booking_id, student_id, sort_order)
select b.id, b.student_id, 1
  from public.bookings b
 where b.student_id is not null
on conflict (booking_id, student_id) do nothing;

alter table public.booking_children enable row level security;

drop policy if exists booking_children_select on public.booking_children;
create policy booking_children_select on public.booking_children
  for select to authenticated
  using (
    exists (
      select 1 from public.bookings b
      where b.id = booking_id
        and (
          b.account_id = auth.uid()
          or b.tutor_id = auth.uid()
          or public.is_admin(auth.uid())
        )
    )
  );

revoke all on public.booking_children from public;
grant select on public.booking_children to authenticated;
grant all on public.booking_children to service_role;

-- ---------------------------------------------------------------------------
-- Per-child report sections (one session_reports row still owns the booking)
-- ---------------------------------------------------------------------------
create table if not exists public.session_report_children (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.session_reports(id) on delete cascade,
  booking_id uuid not null references public.bookings(id) on delete cascade,
  student_id uuid not null references public.students(id),
  student_first_name text not null,
  focus_rating text not null,
  work_summary text not null,
  redirection_level text not null,
  guide_note text,
  created_at timestamptz not null default now(),
  unique (report_id, student_id)
);

create index if not exists session_report_children_booking_idx
  on public.session_report_children (booking_id);

alter table public.session_report_children enable row level security;

drop policy if exists session_report_children_select on public.session_report_children;
create policy session_report_children_select on public.session_report_children
  for select to authenticated
  using (
    exists (
      select 1 from public.session_reports r
      where r.id = report_id
        and (
          r.account_id = auth.uid()
          or r.tutor_id = auth.uid()
          or public.is_admin(auth.uid())
        )
    )
  );

revoke all on public.session_report_children from public;
grant select on public.session_report_children to authenticated;
grant all on public.session_report_children to service_role;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.normalize_student_ids(p_ids uuid[])
returns uuid[]
language plpgsql immutable as $$
declare
  v uuid;
  v_out uuid[] := '{}';
begin
  if p_ids is null then return '{}'; end if;
  foreach v in array p_ids loop
    if v is not null and not (v = any(v_out)) then
      v_out := v_out || v;
    end if;
  end loop;
  return v_out;
end;
$$;

create or replace function public.household_students_overlap(
  p_ids uuid[],
  p_start timestamptz,
  p_end timestamptz,
  p_except uuid default null
) returns boolean
language sql stable as $$
  select exists (
    select 1
      from public.bookings b
     where b.status in ('pending', 'confirmed')
       and b.scheduled_start is not null
       and b.scheduled_end is not null
       and (p_except is null or b.id is distinct from p_except)
       and tstzrange(b.scheduled_start, b.scheduled_end, '[)') && tstzrange(p_start, p_end, '[)')
       and (
         b.student_id = any(p_ids)
         or exists (
           select 1 from public.booking_children bc
            where bc.booking_id = b.id and bc.student_id = any(p_ids)
         )
       )
  );
$$;

create or replace function public.attach_booking_children(p_booking uuid, p_student_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bk record;
  v_ids uuid[];
  v_id uuid;
  v_i int := 0;
  v_names text[] := '{}';
  v_name text;
  v_acct uuid;
begin
  select * into v_bk from public.bookings where id = p_booking;
  if v_bk.id is null then raise exception 'Booking not found'; end if;

  v_ids := public.normalize_student_ids(p_student_ids);
  if coalesce(array_length(v_ids, 1), 0) < 1 then
    v_ids := array[v_bk.student_id];
  end if;
  if array_length(v_ids, 1) > 3 then
    raise exception 'Up to 3 children can join the same Study Hall.';
  end if;
  if not (v_bk.student_id = any(v_ids)) then
    v_ids := array[v_bk.student_id] || v_ids;
    v_ids := public.normalize_student_ids(v_ids);
    if array_length(v_ids, 1) > 3 then
      raise exception 'Up to 3 children can join the same Study Hall.';
    end if;
  end if;

  foreach v_id in array v_ids loop
    select account_id, split_part(full_name, ' ', 1)
      into v_acct, v_name
      from public.students where id = v_id;
    if v_acct is null then raise exception 'Student not found'; end if;
    if v_acct is distinct from v_bk.account_id then
      raise exception 'Not authorized to book for this student';
    end if;
    v_i := v_i + 1;
    v_names := v_names || v_name;
    insert into public.booking_children (booking_id, student_id, sort_order)
    values (p_booking, v_id, v_i)
    on conflict (booking_id, student_id) do update set sort_order = excluded.sort_order;
  end loop;

  update public.bookings
     set student_first_names = v_names,
         child_count = array_length(v_ids, 1),
         student_first_name = v_names[1]
   where id = p_booking;
end;
$$;

-- ---------------------------------------------------------------------------
-- create_booking — optional p_student_ids; price still duration-only
-- ---------------------------------------------------------------------------
drop function if exists public.create_booking(uuid, uuid, text, text, integer, timestamp with time zone, boolean);

create or replace function public.create_booking(
  p_student_id uuid,
  p_subject_id uuid,
  p_other_subject text,
  p_request_note text,
  p_duration integer,
  p_start timestamp with time zone,
  p_is_free_trial boolean,
  p_student_ids uuid[] default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
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
  v_hold constant interval := interval '15 minutes';
  v_ids uuid[];
  v_id uuid;
  v_acct uuid;
begin
  perform public.release_expired_holds();

  v_ids := public.normalize_student_ids(coalesce(p_student_ids, array[p_student_id]));
  if p_student_id is not null and not (p_student_id = any(v_ids)) then
    v_ids := array[p_student_id] || v_ids;
    v_ids := public.normalize_student_ids(v_ids);
  end if;
  if coalesce(array_length(v_ids, 1), 0) < 1 then
    raise exception 'Student not found';
  end if;
  if array_length(v_ids, 1) > 3 then
    raise exception 'Up to 3 children can join the same Study Hall.';
  end if;

  -- First child remains the bookings.student_id for backward compatibility.
  p_student_id := v_ids[1];

  foreach v_id in array v_ids loop
    select account_id into v_acct from public.students where id = v_id;
    if v_acct is null then raise exception 'Student not found'; end if;
    if v_account is null then v_account := v_acct; end if;
    if v_acct is distinct from v_account then
      raise exception 'Not authorized to book for this student';
    end if;
  end loop;

  select split_part(full_name, ' ', 1), grade_level
    into v_first_name, v_grade
  from public.students where id = p_student_id;

  if v_caller is distinct from v_account and not public.is_admin(v_caller) then
    raise exception 'Not authorized to book for this student';
  end if;

  if p_duration not in (30, 60, 120, 180) then
    raise exception 'Invalid duration';
  end if;
  if p_subject_id is null and p_start is not null and p_duration not in (60, 120, 180) then
    raise exception 'Study Hall sessions are 1, 2, or 3 hours';
  end if;

  if p_is_free_trial then
    if p_duration <> 60 then
      raise exception 'The free trial is 60 minutes only';
    end if;
    perform pg_advisory_xact_lock(hashtext('freetrial:' || v_account::text));
    if public.account_has_used_free_trial(v_account) then
      raise exception 'Your account has already used its free trial';
    end if;
    v_price := 0;
  else
    v_price := public.session_list_price_cents(p_duration);
  end if;

  if p_subject_id is null and p_start is null then
    if coalesce(btrim(p_other_subject), '') = '' then
      raise exception 'Describe what your child needs help with';
    end if;
    insert into public.bookings (
      student_id, account_id, other_subject_text, request_note, duration_minutes,
      is_free_trial, price_cents, status, payment_status,
      student_first_name, student_grade, child_count
    ) values (
      p_student_id, v_account, p_other_subject, p_request_note, p_duration,
      p_is_free_trial, v_price, 'pending',
      case when p_is_free_trial then 'not_required' else 'awaiting_payment' end,
      v_first_name, v_grade, array_length(v_ids, 1)
    ) returning id into v_booking_id;
    perform public.attach_booking_children(v_booking_id, v_ids);
    return v_booking_id;
  end if;

  if p_subject_id is not null then
    select name, is_active into v_subject_name, v_subject_active
    from public.subjects where id = p_subject_id;
    if v_subject_name is null then raise exception 'Subject not found'; end if;
    if not v_subject_active then raise exception 'Subject is not currently available'; end if;
  else
    v_subject_name := null;
    v_subject_active := true;
  end if;

  if p_start is null then raise exception 'A start time is required'; end if;
  if p_start < now() then raise exception 'Cannot book a time in the past'; end if;
  v_end := p_start + make_interval(mins => p_duration);

  if public.household_students_overlap(v_ids, p_start, v_end, null) then
    raise exception 'One of these children already has a Study Hall at that time.';
  end if;

  for v_tutor in
    select tp.profile_id as tutor_id,
           coalesce(tp.timezone, 'Africa/Lagos') as tz,
           pr.display_name,
           (exists (
              select 1 from public.bookings b2
              where b2.tutor_id = tp.profile_id
                and b2.status = 'completed'
                and (p_subject_id is null or b2.subject_id = p_subject_id)
                and (
                  b2.student_id = any(v_ids)
                  or exists (
                    select 1 from public.booking_children bc
                     where bc.booking_id = b2.id and bc.student_id = any(v_ids)
                  )
                )
           )) as is_repeat,
           (select count(*) from public.bookings b3
              where b3.tutor_id = tp.profile_id
                and b3.status in ('pending','confirmed')
                and b3.scheduled_start >= now()) as upcoming_load
    from public.tutor_profiles tp
    join public.profiles pr on pr.id = tp.profile_id
    where tp.status = 'approved'
      and pr.role = 'tutor'
      and coalesce(btrim(tp.timezone), '') <> ''
      and (
        p_subject_id is null
        or exists (
          select 1 from public.tutor_subjects ts
          where ts.tutor_id = tp.profile_id and ts.subject_id = p_subject_id
        )
      )
    order by is_repeat desc, upcoming_load asc, tp.profile_id asc
  loop
    if public.tutor_is_available(v_tutor.tutor_id, v_tutor.tz, p_start, v_end) then
      begin
        insert into public.bookings (
          student_id, account_id, tutor_id, subject_id, request_note,
          scheduled_start, scheduled_end, duration_minutes, is_free_trial,
          price_cents, status, payment_status, payment_hold_expires_at,
          student_first_name, student_grade, subject_name, tutor_display_name,
          child_count
        ) values (
          p_student_id, v_account, v_tutor.tutor_id, p_subject_id, p_request_note,
          p_start, v_end, p_duration, p_is_free_trial,
          v_price,
          (case when p_is_free_trial then 'confirmed' else 'pending' end)::public.booking_status,
          case when p_is_free_trial then 'not_required' else 'awaiting_payment' end,
          case when p_is_free_trial then null else now() + v_hold end,
          v_first_name, v_grade, v_subject_name, v_tutor.display_name,
          array_length(v_ids, 1)
        ) returning id into v_booking_id;
        perform public.attach_booking_children(v_booking_id, v_ids);
        return v_booking_id;
      exception when exclusion_violation then
        continue;
      when unique_violation then
        raise exception 'Your account has already used its free trial';
      end;
    end if;
  end loop;

  raise exception 'No Guide is available for that time. Please choose another slot.';
end;
$$;

revoke all on function public.create_booking(uuid, uuid, text, text, integer, timestamp with time zone, boolean, uuid[]) from public;
grant execute on function public.create_booking(uuid, uuid, text, text, integer, timestamp with time zone, boolean, uuid[])
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- book_session — optional p_student_ids; funding still duration-only
-- ---------------------------------------------------------------------------
drop function if exists public.book_session(uuid, uuid, text, text, integer, timestamp with time zone, boolean);

create or replace function public.book_session(
  p_student_id uuid,
  p_subject_id uuid,
  p_other_subject text,
  p_request_note text,
  p_duration int,
  p_start timestamptz,
  p_is_free_trial boolean,
  p_student_ids uuid[] default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_account uuid;
  v_caller uuid := auth.uid();
  v_price int;
  v_pkg_bal int;
  v_credit_bal int;
  v_pkg_used int := 0;
  v_credit_used int := 0;
  v_stripe_due int := 0;
  v_funding text;
  v_booking_id uuid;
  v_payment_id uuid;
  v_status text;
  v_hold constant interval := interval '15 minutes';
  v_ids uuid[];
  v_id uuid;
  v_acct uuid;
begin
  v_ids := public.normalize_student_ids(coalesce(p_student_ids, array[p_student_id]));
  if p_student_id is not null and not (p_student_id = any(v_ids)) then
    v_ids := array[p_student_id] || v_ids;
    v_ids := public.normalize_student_ids(v_ids);
  end if;
  if coalesce(array_length(v_ids, 1), 0) < 1 then raise exception 'Student not found'; end if;
  if array_length(v_ids, 1) > 3 then
    raise exception 'Up to 3 children can join the same Study Hall.';
  end if;
  p_student_id := v_ids[1];

  foreach v_id in array v_ids loop
    select account_id into v_acct from public.students where id = v_id;
    if v_acct is null then raise exception 'Student not found'; end if;
    if v_account is null then v_account := v_acct; end if;
    if v_acct is distinct from v_account then
      raise exception 'Not authorized to book for this student';
    end if;
  end loop;

  if v_caller is not null and v_caller is distinct from v_account and not public.is_admin(v_caller) then
    raise exception 'Not authorized to book for this student';
  end if;

  perform public.release_expired_holds();

  if p_duration not in (30, 60, 120, 180) then raise exception 'Invalid duration'; end if;
  if p_subject_id is null and p_start is not null and p_duration not in (60, 120, 180) then
    raise exception 'Study Hall sessions are 1, 2, or 3 hours';
  end if;

  if p_is_free_trial then
    if p_duration <> 60 then raise exception 'The free trial is 60 minutes only'; end if;
    v_booking_id := public.create_booking(
      p_student_id, p_subject_id, p_other_subject, p_request_note, 60, p_start, true, v_ids);
    insert into public.payments (account_id, purpose, booking_id, gross_cents, stripe_paid_cents, credit_applied_cents, status, fulfilled_at)
      values (v_account, 'booking', v_booking_id, 0, 0, 0, 'succeeded', now())
      returning id into v_payment_id;
    select status::text into v_status from public.bookings where id = v_booking_id;
    return jsonb_build_object(
      'booking_id', v_booking_id, 'payment_id', v_payment_id, 'funding', 'free_trial',
      'session_price_cents', 0, 'package_minutes_used', 0, 'credit_cents_used', 0,
      'stripe_cents_due', 0, 'booking_status', v_status);
  end if;

  v_price := public.session_list_price_cents(p_duration);

  if p_subject_id is null and p_start is null then
    v_booking_id := public.create_booking(
      p_student_id, null, p_other_subject, p_request_note, p_duration, null, false, v_ids);
    insert into public.payments (account_id, purpose, booking_id, gross_cents, status)
      values (v_account, 'booking', v_booking_id, v_price, 'created')
      returning id into v_payment_id;
    return jsonb_build_object(
      'booking_id', v_booking_id, 'payment_id', v_payment_id, 'funding', 'request',
      'session_price_cents', v_price, 'package_minutes_used', 0, 'credit_cents_used', 0,
      'stripe_cents_due', 0, 'booking_status', 'pending');
  end if;

  perform pg_advisory_xact_lock(hashtext('pkgmin:' || v_account::text));
  v_pkg_bal := coalesce((select sum(minutes_delta) from public.package_minute_ledger where account_id = v_account), 0);

  if v_pkg_bal >= p_duration then
    v_funding := 'package'; v_pkg_used := p_duration; v_credit_used := 0; v_stripe_due := 0;
  else
    v_pkg_used := 0;
    perform pg_advisory_xact_lock(hashtext('dollar:' || v_account::text));
    v_credit_bal := coalesce((select sum(amount_cents) from public.dollar_credit_ledger where account_id = v_account), 0);
    v_credit_used := least(greatest(v_credit_bal, 0), v_price);
    v_stripe_due := v_price - v_credit_used;
    v_funding := case when v_stripe_due = 0 then 'credit' else 'stripe' end;
  end if;

  v_booking_id := public.create_booking(
    p_student_id, p_subject_id, p_other_subject, p_request_note, p_duration, p_start, false, v_ids);

  if v_funding = 'package' then
    insert into public.payments (account_id, purpose, booking_id, gross_cents, stripe_paid_cents, credit_applied_cents, status, fulfilled_at)
      values (v_account, 'booking', v_booking_id, v_price, 0, 0, 'succeeded', now())
      returning id into v_payment_id;
    insert into public.package_minute_ledger (account_id, minutes_delta, entry_type, payment_id, booking_id, reason, reference, created_by)
      values (v_account, -p_duration, 'consumption', v_payment_id, v_booking_id, 'booking paid with package minutes', 'book:' || v_booking_id::text || ':pkg', v_caller);
    update public.bookings set status = 'confirmed', payment_status = 'paid', payment_hold_expires_at = null where id = v_booking_id;
    v_status := 'confirmed';

  elsif v_funding = 'credit' then
    insert into public.payments (account_id, purpose, booking_id, gross_cents, stripe_paid_cents, credit_applied_cents, status, fulfilled_at)
      values (v_account, 'booking', v_booking_id, v_price, 0, v_credit_used, 'succeeded', now())
      returning id into v_payment_id;
    insert into public.dollar_credit_ledger (account_id, amount_cents, entry_type, payment_id, booking_id, reason, reference, created_by)
      values (v_account, -v_credit_used, 'consumption', v_payment_id, v_booking_id, 'booking paid with account credit', 'book:' || v_booking_id::text || ':credit', v_caller);
    update public.bookings set status = 'confirmed', payment_status = 'paid', payment_hold_expires_at = null where id = v_booking_id;
    v_status := 'confirmed';

  else
    insert into public.payments (account_id, purpose, booking_id, gross_cents, stripe_paid_cents, credit_applied_cents, status, expires_at)
      values (v_account, 'booking', v_booking_id, v_price, 0, v_credit_used, 'requires_payment', now() + v_hold)
      returning id into v_payment_id;
    if v_credit_used > 0 then
      insert into public.dollar_credit_ledger (account_id, amount_cents, entry_type, payment_id, booking_id, reason, reference, created_by)
        values (v_account, -v_credit_used, 'consumption', v_payment_id, v_booking_id, 'credit reserved for booking (awaiting Stripe)', 'book:' || v_booking_id::text || ':credit', v_caller);
    end if;
    v_status := 'awaiting_payment';
  end if;

  return jsonb_build_object(
    'booking_id', v_booking_id, 'payment_id', v_payment_id, 'funding', v_funding,
    'session_price_cents', v_price, 'package_minutes_used', v_pkg_used,
    'credit_cents_used', v_credit_used, 'stripe_cents_due', v_stripe_due,
    'booking_status', v_status);
end;
$$;

revoke all on function public.book_session(uuid, uuid, text, text, integer, timestamp with time zone, boolean, uuid[]) from public;
grant execute on function public.book_session(uuid, uuid, text, text, integer, timestamp with time zone, boolean, uuid[])
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Session join: Guide counterpart lists household children. Window unchanged.
-- ---------------------------------------------------------------------------
create or replace function public.authorize_session_join(p_booking uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_bk record;
  v_uid uuid := auth.uid();
  v_role text;
  v_open timestamptz;
  v_close timestamptz;
  v_state text;
  v_safe text;
  v_counter text;
  v_children text;
begin
  select * into v_bk from public.bookings where id = p_booking;
  if v_bk.id is null then return jsonb_build_object('authorized', false, 'reason', 'not_found'); end if;

  if v_uid is not null and v_uid = v_bk.account_id then v_role := 'student';
  elsif v_uid is not null and v_uid = v_bk.tutor_id then v_role := 'tutor';
  elsif public.is_admin(v_uid) then v_role := 'admin';
  else return jsonb_build_object('authorized', false, 'reason', 'forbidden');
  end if;

  if v_bk.scheduled_start is not null then
    v_open := v_bk.scheduled_start - interval '5 minutes';
    v_close := coalesce(v_bk.scheduled_end, v_bk.scheduled_start + make_interval(mins => coalesce(v_bk.duration_minutes, 0))) + interval '15 minutes';
  end if;

  if v_bk.status <> 'confirmed' then
    v_state := 'not_joinable';
  elsif v_bk.scheduled_start is null then
    v_state := 'not_scheduled';
  elsif now() < v_open then
    v_state := 'too_early';
  elsif now() > v_close then
    v_state := 'too_late';
  else
    v_state := 'open';
  end if;

  if v_role = 'admin' and v_bk.status = 'confirmed' and v_bk.scheduled_start is not null then
    v_state := 'open';
  end if;

  if coalesce(array_length(v_bk.student_first_names, 1), 0) >= 2 then
    if array_length(v_bk.student_first_names, 1) = 2 then
      v_children := v_bk.student_first_names[1] || ' & ' || v_bk.student_first_names[2];
    else
      v_children := array_to_string(v_bk.student_first_names[1:array_length(v_bk.student_first_names,1)-1], ', ')
        || ' & ' || v_bk.student_first_names[array_length(v_bk.student_first_names, 1)];
    end if;
  else
    v_children := coalesce(nullif(v_bk.student_first_name, ''), 'Student');
  end if;

  v_safe := case
    when v_role = 'student' then coalesce(nullif(v_bk.student_first_name, ''), 'Student')
    when v_role = 'tutor' then coalesce(nullif(split_part(coalesce(v_bk.tutor_display_name, ''), ' ', 1), ''), 'Guide')
    else 'Admin' end;
  v_counter := case
    when v_role = 'student' then coalesce(nullif(split_part(coalesce(v_bk.tutor_display_name, ''), ' ', 1), ''), 'Your Guide')
    else v_children end;

  return jsonb_build_object(
    'authorized', true,
    'role', v_role,
    'status', v_bk.status::text,
    'subject', coalesce(v_bk.subject_name, v_bk.other_subject_text),
    'scheduled_start', v_bk.scheduled_start,
    'scheduled_end', v_bk.scheduled_end,
    'duration_minutes', v_bk.duration_minutes,
    'join_open_at', v_open,
    'join_close_at', v_close,
    'server_now', now(),
    'join_state', v_state,
    'room_name', 'at-' || replace(p_booking::text, '-', ''),
    'is_owner', (v_role = 'admin'),
    'safe_name', v_safe,
    'counterpart', v_counter,
    'child_names', to_jsonb(coalesce(v_bk.student_first_names, array[v_bk.student_first_name])));
end;
$$;

-- ---------------------------------------------------------------------------
-- Reports: existing one-child RPC still works; household RPC writes sections
-- ---------------------------------------------------------------------------
create or replace function public.submit_session_report(
  p_booking uuid,
  p_focus text,
  p_work_summary text,
  p_redirection text,
  p_guide_note text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_bk record;
  v_id uuid;
  v_work text := btrim(coalesce(p_work_summary, ''));
  v_note text := nullif(btrim(coalesce(p_guide_note, '')), '');
  v_child uuid;
  v_child_name text;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  select id, tutor_id, account_id, status, student_id, student_first_name
    into v_bk
    from public.bookings
   where id = p_booking;

  if v_bk.id is null then raise exception 'Booking not found'; end if;
  if v_bk.tutor_id is null then raise exception 'This booking has no assigned Guide'; end if;
  if v_uid is distinct from v_bk.tutor_id and not public.is_admin(v_uid) then
    raise exception 'Not authorized';
  end if;
  if v_bk.status is distinct from 'completed' then
    raise exception 'Reports can only be submitted for completed Study Hall sessions';
  end if;
  if p_focus is null or p_focus not in (
    'great_focus', 'good_focus', 'needed_redirection', 'difficult_session'
  ) then
    raise exception 'A valid focus rating is required';
  end if;
  if p_redirection is null or p_redirection not in ('none', 'a_little', 'several_times') then
    raise exception 'A valid redirection level is required';
  end if;
  if char_length(v_work) < 1 or char_length(v_work) > 280 then
    raise exception 'What they worked on is required (1–280 characters)';
  end if;
  if v_note is not null and char_length(v_note) > 280 then
    raise exception 'Guide note must be at most 280 characters';
  end if;

  begin
    insert into public.session_reports (
      booking_id, tutor_id, account_id,
      focus_rating, work_summary, redirection_level, guide_note
    ) values (
      p_booking, v_bk.tutor_id, v_bk.account_id,
      p_focus, v_work, p_redirection, v_note
    )
    returning id into v_id;
  exception when unique_violation then
    raise exception 'A report has already been submitted for this session';
  end;

  select bc.student_id, coalesce(nullif(split_part(s.full_name, ' ', 1), ''), v_bk.student_first_name, 'Child')
    into v_child, v_child_name
    from public.booking_children bc
    join public.students s on s.id = bc.student_id
   where bc.booking_id = p_booking
   order by bc.sort_order
   limit 1;

  if v_child is null then
    v_child := v_bk.student_id;
    v_child_name := coalesce(v_bk.student_first_name, 'Child');
  end if;

  insert into public.session_report_children (
    report_id, booking_id, student_id, student_first_name,
    focus_rating, work_summary, redirection_level, guide_note
  ) values (
    v_id, p_booking, v_child, v_child_name,
    p_focus, v_work, p_redirection, v_note
  );

  return v_id;
end;
$$;

create or replace function public.submit_household_session_report(
  p_booking uuid,
  p_child_reports jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_bk record;
  v_id uuid;
  v_row jsonb;
  v_sid uuid;
  v_focus text;
  v_work text;
  v_redirection text;
  v_note text;
  v_name text;
  v_expected int;
  v_got int := 0;
  v_first jsonb;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  select id, tutor_id, account_id, status, student_id, student_first_name, child_count
    into v_bk
    from public.bookings
   where id = p_booking;

  if v_bk.id is null then raise exception 'Booking not found'; end if;
  if v_bk.tutor_id is null then raise exception 'This booking has no assigned Guide'; end if;
  if v_uid is distinct from v_bk.tutor_id and not public.is_admin(v_uid) then
    raise exception 'Not authorized';
  end if;
  if v_bk.status is distinct from 'completed' then
    raise exception 'Reports can only be submitted for completed Study Hall sessions';
  end if;
  if p_child_reports is null or jsonb_typeof(p_child_reports) <> 'array' then
    raise exception 'A report is required for each child';
  end if;

  select count(*) into v_expected from public.booking_children where booking_id = p_booking;
  if v_expected < 1 then v_expected := 1; end if;
  if jsonb_array_length(p_child_reports) <> v_expected then
    raise exception 'A report is required for each child';
  end if;

  v_first := p_child_reports -> 0;

  begin
    insert into public.session_reports (
      booking_id, tutor_id, account_id,
      focus_rating, work_summary, redirection_level, guide_note
    ) values (
      p_booking, v_bk.tutor_id, v_bk.account_id,
      v_first ->> 'focus',
      btrim(coalesce(v_first ->> 'work_summary', '')),
      v_first ->> 'redirection',
      nullif(btrim(coalesce(v_first ->> 'guide_note', '')), '')
    )
    returning id into v_id;
  exception when unique_violation then
    raise exception 'A report has already been submitted for this session';
  end;

  for v_row in select value from jsonb_array_elements(p_child_reports)
  loop
    v_sid := nullif(v_row ->> 'student_id', '')::uuid;
    v_focus := v_row ->> 'focus';
    v_work := btrim(coalesce(v_row ->> 'work_summary', ''));
    v_redirection := v_row ->> 'redirection';
    v_note := nullif(btrim(coalesce(v_row ->> 'guide_note', '')), '');

    if v_sid is null or not exists (
      select 1 from public.booking_children bc
       where bc.booking_id = p_booking and bc.student_id = v_sid
    ) then
      if v_sid is distinct from v_bk.student_id then
        raise exception 'Not authorized';
      end if;
    end if;

    if v_focus is null or v_focus not in (
      'great_focus', 'good_focus', 'needed_redirection', 'difficult_session'
    ) then
      raise exception 'A valid focus rating is required';
    end if;
    if v_redirection is null or v_redirection not in ('none', 'a_little', 'several_times') then
      raise exception 'A valid redirection level is required';
    end if;
    if char_length(v_work) < 1 or char_length(v_work) > 280 then
      raise exception 'What they worked on is required (1–280 characters)';
    end if;
    if v_note is not null and char_length(v_note) > 280 then
      raise exception 'Guide note must be at most 280 characters';
    end if;

    select split_part(full_name, ' ', 1) into v_name from public.students where id = v_sid;
    insert into public.session_report_children (
      report_id, booking_id, student_id, student_first_name,
      focus_rating, work_summary, redirection_level, guide_note
    ) values (
      v_id, p_booking, coalesce(v_sid, v_bk.student_id), coalesce(nullif(v_name, ''), 'Child'),
      v_focus, v_work, v_redirection, v_note
    );
    v_got := v_got + 1;
  end loop;

  return v_id;
end;
$$;

revoke all on function public.submit_household_session_report(uuid, jsonb) from public;
grant execute on function public.submit_household_session_report(uuid, jsonb)
  to authenticated, service_role;

revoke all on function public.attach_booking_children(uuid, uuid[]) from public;
grant execute on function public.attach_booking_children(uuid, uuid[]) to service_role;

comment on table public.booking_children is
  'Children attending a household Study Hall. 1–3 per booking; one charge.';
comment on column public.bookings.child_count is
  'Number of children on this Study Hall (1–3). Price is duration-only.';
