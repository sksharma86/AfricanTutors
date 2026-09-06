-- Extra stubs so 0038 book_session/create_booking can run on the throwaway DB.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'booking_status') then
    create type public.booking_status as enum ('pending','confirmed','completed','cancelled','no_show','expired');
  end if;
end $$;

alter table public.students add column if not exists full_name text;
alter table public.students add column if not exists grade_level text;
alter table public.bookings add column if not exists student_id uuid;
alter table public.bookings add column if not exists tutor_id uuid;
alter table public.bookings add column if not exists subject_id uuid;
alter table public.bookings add column if not exists request_note text;
alter table public.bookings add column if not exists other_subject_text text;
alter table public.bookings add column if not exists scheduled_start timestamptz;
alter table public.bookings add column if not exists scheduled_end timestamptz;
alter table public.bookings add column if not exists duration_minutes int;
alter table public.bookings add column if not exists is_free_trial boolean not null default false;
alter table public.bookings add column if not exists price_cents int;
alter table public.bookings add column if not exists payment_status text;
alter table public.bookings add column if not exists payment_hold_expires_at timestamptz;
alter table public.bookings add column if not exists student_first_name text;
alter table public.bookings add column if not exists student_grade text;
alter table public.bookings add column if not exists subject_name text;
alter table public.bookings add column if not exists tutor_display_name text;
alter table public.bookings add column if not exists child_count int;
alter table public.bookings add column if not exists funding_source text;
alter table public.bookings add column if not exists public_reference text;
alter table public.bookings add column if not exists cancelled_at timestamptz;
alter table public.bookings drop column if exists status;
alter table public.bookings add column if not exists status public.booking_status not null default 'pending';

create table if not exists public.booking_children (
  booking_id uuid references public.bookings(id) on delete cascade,
  student_id uuid references public.students(id),
  primary key (booking_id, student_id)
);

create table if not exists public.tutor_profiles (
  profile_id uuid primary key references public.profiles(id),
  status text not null default 'approved',
  timezone text default 'Africa/Lagos'
);

create table if not exists public.tutor_subjects (
  tutor_id uuid not null,
  subject_id uuid not null,
  primary key (tutor_id, subject_id)
);

create or replace function public.normalize_student_ids(p_ids uuid[])
returns uuid[] language sql immutable as $$
  select coalesce((select array_agg(distinct x) from unnest(p_ids) as x where x is not null), array[]::uuid[]);
$$;

create or replace function public.attach_booking_children(p_booking uuid, p_ids uuid[])
returns void language plpgsql as $$
begin
  insert into public.booking_children (booking_id, student_id)
  select p_booking, unnest(p_ids)
  on conflict do nothing;
end;
$$;

create or replace function public.household_students_overlap(p_ids uuid[], p_start timestamptz, p_end timestamptz, p_ignore uuid)
returns boolean language sql stable as $$
  select false;
$$;

create or replace function public.tutor_is_available(p_tutor uuid, p_tz text, p_start timestamptz, p_end timestamptz)
returns boolean language sql stable as $$
  select true;
$$;

create or replace function public.release_expired_holds()
returns void language sql as $$
  select 1;
$$;

create or replace function public.account_has_used_free_trial(p_account uuid)
returns boolean language sql stable as $$
  select exists (
    select 1 from public.bookings
     where account_id = p_account and is_free_trial and status <> 'cancelled'
  );
$$;

create or replace function public.session_list_price_cents(p_duration integer)
returns integer language plpgsql immutable as $$
begin
  if p_duration = 30 then return 1200; end if;
  if p_duration in (60, 120, 180) then return (p_duration / 60) * 1200; end if;
  raise exception 'Invalid duration';
end;
$$;

create unique index if not exists bookings_one_free_trial_per_account
  on public.bookings (account_id)
  where is_free_trial and status <> 'cancelled';

create or replace function public.restore_booking_value(p_booking uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_account uuid; v_pkg int; v_pay record; v_restore int;
begin
  select account_id into v_account from public.bookings where id = p_booking;
  select coalesce(-sum(minutes_delta), 0) into v_pkg
    from public.package_minute_ledger where booking_id = p_booking and entry_type = 'consumption';
  if v_pkg > 0 then
    insert into public.package_minute_ledger (account_id, minutes_delta, entry_type, booking_id, reason, reference, created_by)
    values (v_account, v_pkg, 'restoration', p_booking, p_reason, 'cancel:pkg:' || p_booking::text, auth.uid())
    on conflict (reference) do nothing;
    return jsonb_build_object('restored_minutes', v_pkg);
  end if;

  select * into v_pay from public.payments
   where booking_id = p_booking and purpose = 'booking' and status = 'succeeded'
   order by created_at desc limit 1;
  if v_pay.id is not null then
    v_restore := v_pay.credit_applied_cents + v_pay.stripe_paid_cents;
    if v_restore > 0 then
      insert into public.dollar_credit_ledger (account_id, amount_cents, entry_type, payment_id, booking_id, reason, reference, created_by)
      values (v_account, v_restore, 'restoration', v_pay.id, p_booking, p_reason, 'cancel:credit:' || p_booking::text, auth.uid())
      on conflict (reference) do nothing;
    end if;
    return jsonb_build_object('restored_credit_cents', v_restore);
  end if;
  return jsonb_build_object('restored', 0);
end;
$$;

create or replace function public.customer_cancel_booking(p_booking uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_account uuid;
  v_caller uuid := auth.uid();
  v_status public.booking_status;
  v_start timestamptz;
  v_early boolean;
  v_res jsonb := '{}'::jsonb;
begin
  select account_id, status, scheduled_start
    into v_account, v_status, v_start
    from public.bookings
   where id = p_booking
   for update;
  if v_account is null then raise exception 'Booking not found'; end if;
  if v_caller is not null and v_caller is distinct from v_account and not public.is_admin(v_caller) then
    raise exception 'Not authorized';
  end if;
  if v_status not in ('pending', 'confirmed') then
    return jsonb_build_object('status', 'noop', 'booking_status', v_status::text);
  end if;
  v_early := (v_start is null) or (v_start - now() >= interval '24 hours');
  if v_early then
    v_res := public.restore_booking_value(p_booking, 'customer cancellation 24h+ — value restored');
  else
    v_res := jsonb_build_object('restored', 0);
  end if;
  update public.bookings set status = 'cancelled', cancelled_at = now() where id = p_booking;
  return jsonb_build_object('status', 'cancelled', 'early', v_early) || v_res;
end;
$$;
