-- =============================================================================
-- Study Hall 365 — parent privacy + booking-start contract (PR #80 hardening)
-- =============================================================================
-- Parents do not need SELECT on raw subscription / day-usage rows.
-- Those tables keep Stripe ids and webhook cursors for server/admin use.
-- Parent-facing access is get_study_hall_365_membership /
-- get_study_hall_365_entitlement (safe fields only).
--
-- Also adds optional p_booking_start so PR3 can ask whether a scheduled
-- Study Hall instant falls inside the paid window. A civil date overlapping
-- the period is not enough when the start instant is outside it.
-- Additive. Idempotent.
-- =============================================================================

drop policy if exists study_hall_365_sub_select_own on public.study_hall_365_subscriptions;
drop policy if exists study_hall_365_usage_select_own on public.study_hall_365_day_usage;

revoke select on public.study_hall_365_subscriptions from authenticated;
revoke select on public.study_hall_365_day_usage from authenticated;

-- Admins retain SELECT (management later). Guides have no policy.
drop policy if exists study_hall_365_sub_select_admin on public.study_hall_365_subscriptions;
drop policy if exists study_hall_365_usage_select_admin on public.study_hall_365_day_usage;

create policy study_hall_365_sub_select_admin on public.study_hall_365_subscriptions
  for select to authenticated
  using (public.is_admin(auth.uid()));

create policy study_hall_365_usage_select_admin on public.study_hall_365_day_usage
  for select to authenticated
  using (public.is_admin(auth.uid()));

grant select on public.study_hall_365_subscriptions to authenticated;
grant select on public.study_hall_365_day_usage to authenticated;

-- ---------------------------------------------------------------------------
-- Parent-facing membership (no Stripe ids, no event cursors)
-- ---------------------------------------------------------------------------
create or replace function public.get_study_hall_365_membership(p_account uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_account uuid := coalesce(p_account, auth.uid());
  v_sub public.study_hall_365_subscriptions;
  v_now timestamptz := now();
  v_entitled boolean;
  v_customer text;
begin
  if v_account is null then raise exception 'Account is required'; end if;
  if auth.uid() is not null and auth.uid() is distinct from v_account and not public.is_admin(auth.uid()) then
    raise exception 'Not authorized';
  end if;

  select * into v_sub
    from public.study_hall_365_subscriptions
   where account_id = v_account
   order by created_at desc
   limit 1;

  if v_sub.id is null then
    return jsonb_build_object('membership', null);
  end if;

  v_entitled := public.study_hall_365_status_entitled(
    v_sub.status, v_sub.cancel_at_period_end, v_sub.current_period_end, v_sub.ended_at, v_now
  );

  if v_entitled and v_sub.cancel_at_period_end then
    v_customer := 'cancels_at_period_end';
  elsif v_entitled then
    v_customer := 'active';
  else
    v_customer := 'inactive';
  end if;

  return jsonb_build_object(
    'membership', jsonb_build_object(
      'customer_status', v_customer,
      'entitled', v_entitled,
      'cancel_at_period_end', v_sub.cancel_at_period_end,
      'current_period_start', v_sub.current_period_start,
      'current_period_end', v_sub.current_period_end
    )
  );
end;
$$;

revoke all on function public.get_study_hall_365_membership(uuid) from public;
grant execute on function public.get_study_hall_365_membership(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Entitlement + consume: optional booking start instant (PR3 contract)
-- ---------------------------------------------------------------------------
drop function if exists public.get_study_hall_365_entitlement(uuid, date, timestamptz);

create or replace function public.get_study_hall_365_entitlement(
  p_account uuid,
  p_local_date date default null,
  p_as_of timestamptz default now(),
  p_booking_start timestamptz default null
) returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_account uuid := coalesce(p_account, auth.uid());
  v_now timestamptz := coalesce(p_as_of, now());
  v_tz text;
  v_date date;
  v_sub public.study_hall_365_subscriptions;
  v_used public.study_hall_365_day_usage;
  v_status_ok boolean := false;
  v_day_ok boolean := false;
  v_start_ok boolean := true;
  v_entitled boolean := false;
  v_reason text;
begin
  if v_account is null then raise exception 'Account is required'; end if;
  if auth.uid() is not null and auth.uid() is distinct from v_account and not public.is_admin(auth.uid()) then
    raise exception 'Not authorized';
  end if;

  v_tz := public.resolve_account_timezone(v_account);
  if p_local_date is not null then
    v_date := p_local_date;
  else
    begin
      v_date := (v_now AT TIME ZONE v_tz)::date;
    exception when others then
      v_date := (v_now AT TIME ZONE 'America/Chicago')::date;
    end;
  end if;

  select * into v_sub
    from public.study_hall_365_subscriptions
   where account_id = v_account
   order by created_at desc
   limit 1;

  if v_sub.id is not null then
    v_status_ok := public.study_hall_365_status_entitled(
      v_sub.status, v_sub.cancel_at_period_end, v_sub.current_period_end, v_sub.ended_at, v_now
    );
    v_day_ok := public.study_hall_365_local_date_overlaps_period(
      v_date, v_tz, v_sub.current_period_start, v_sub.current_period_end
    );
    if p_booking_start is not null then
      v_start_ok := p_booking_start >= v_sub.current_period_start
                and p_booking_start < v_sub.current_period_end;
    end if;
    select * into v_used
      from public.study_hall_365_day_usage
     where account_id = v_account and local_date = v_date;
  end if;

  if v_sub.id is null then
    v_reason := 'no_membership';
  elsif not v_status_ok then
    v_reason := 'status_not_entitled';
  elsif not v_day_ok then
    v_reason := 'outside_paid_period';
  elsif not v_start_ok then
    v_reason := 'booking_outside_paid_window';
  elsif v_used.id is not null then
    v_reason := 'already_consumed';
  else
    v_entitled := true;
    v_reason := 'available';
  end if;

  return jsonb_build_object(
    'entitled', v_entitled,
    'source', case when v_entitled then 'study_hall_365' else 'none' end,
    'reason', v_reason,
    'local_date', v_date,
    'time_zone', v_tz,
    'status', v_sub.status,
    'cancel_at_period_end', v_sub.cancel_at_period_end,
    'current_period_start', v_sub.current_period_start,
    'current_period_end', v_sub.current_period_end,
    'ended_at', v_sub.ended_at,
    'consumed', v_used.id is not null,
    'consumed_booking_id', v_used.booking_id
  );
end;
$$;

revoke all on function public.get_study_hall_365_entitlement(uuid, date, timestamptz, timestamptz) from public;
grant execute on function public.get_study_hall_365_entitlement(uuid, date, timestamptz, timestamptz)
  to authenticated, service_role;

drop function if exists public.consume_study_hall_365_day(uuid, date, uuid, timestamptz);

create or replace function public.consume_study_hall_365_day(
  p_account uuid,
  p_local_date date,
  p_booking_id uuid default null,
  p_as_of timestamptz default now(),
  p_booking_start timestamptz default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub public.study_hall_365_subscriptions;
  v_tz text;
  v_id uuid;
  v_now timestamptz := coalesce(p_as_of, now());
begin
  if not public.is_financial_actor() then raise exception 'Not authorized'; end if;
  if p_account is null or p_local_date is null then
    raise exception 'account and local date are required';
  end if;

  v_tz := public.resolve_account_timezone(p_account);

  select * into v_sub
    from public.study_hall_365_subscriptions
   where account_id = p_account
     and ended_at is null
     and public.study_hall_365_status_entitled(
       status, cancel_at_period_end, current_period_end, ended_at, v_now
     )
     and public.study_hall_365_local_date_overlaps_period(
       p_local_date, v_tz, current_period_start, current_period_end
     )
     and (
       p_booking_start is null
       or (p_booking_start >= current_period_start and p_booking_start < current_period_end)
     )
   order by current_period_end desc
   limit 1
   for update;

  if v_sub.id is null then
    return jsonb_build_object(
      'ok', false,
      'reason', case
        when p_booking_start is not null then 'not_entitled_or_outside_paid_window'
        else 'not_entitled'
      end,
      'local_date', p_local_date,
      'time_zone', v_tz
    );
  end if;

  insert into public.study_hall_365_day_usage (
    account_id, subscription_id, local_date, time_zone, booking_id
  ) values (
    p_account, v_sub.id, p_local_date, v_tz, p_booking_id
  )
  on conflict (account_id, local_date) do nothing
  returning id into v_id;

  if v_id is null then
    return jsonb_build_object(
      'ok', false,
      'reason', 'already_consumed',
      'local_date', p_local_date,
      'time_zone', v_tz
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'reason', 'consumed',
    'id', v_id,
    'local_date', p_local_date,
    'time_zone', v_tz,
    'booking_id', p_booking_id,
    'source', 'study_hall_365'
  );
end;
$$;

revoke all on function public.consume_study_hall_365_day(uuid, date, uuid, timestamptz, timestamptz) from public;
grant execute on function public.consume_study_hall_365_day(uuid, date, uuid, timestamptz, timestamptz)
  to service_role;

notify pgrst, 'reload schema';
