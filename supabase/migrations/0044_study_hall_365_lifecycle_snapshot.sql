-- PR7B: return previous vs current membership snapshots from the existing
-- Study Hall 365 upsert so lifecycle emails can be classified AFTER the
-- authoritative row write (FOR UPDATE), never from a raw Stripe event type.
--
-- No new tables or columns. Signature unchanged. Do not apply in production
-- from this branch; this file is the migration to apply through the normal
-- (non-production) path later.

create or replace function public.upsert_study_hall_365_subscription(
  p_account uuid,
  p_stripe_customer_id text,
  p_stripe_subscription_id text,
  p_stripe_price_id text,
  p_status text,
  p_period_start timestamptz,
  p_period_end timestamptz,
  p_cancel_at_period_end boolean,
  p_canceled_at timestamptz,
  p_ended_at timestamptz,
  p_latest_invoice_id text,
  p_event_id text,
  p_event_created integer,
  p_payment_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.study_hall_365_subscriptions;
  v_status text;
  v_ended timestamptz;
  v_previous jsonb;
  v_current jsonb;
begin
  if not public.is_financial_actor() then raise exception 'Not authorized'; end if;
  if p_account is null or p_stripe_subscription_id is null or p_stripe_customer_id is null then
    raise exception 'subscription identity is required';
  end if;
  if p_period_start is null or p_period_end is null or p_period_end <= p_period_start then
    raise exception 'valid billing period is required';
  end if;

  v_status := p_status;
  if v_status is null or v_status not in (
    'active', 'trialing', 'past_due', 'unpaid', 'incomplete',
    'incomplete_expired', 'paused', 'canceled', 'ended'
  ) then
    raise exception 'unsupported subscription status';
  end if;

  v_ended := p_ended_at;
  if v_status in ('incomplete_expired', 'ended') then
    v_ended := coalesce(v_ended, now());
  end if;

  v_current := jsonb_build_object(
    'status', v_status,
    'cancel_at_period_end', coalesce(p_cancel_at_period_end, false),
    'current_period_start', p_period_start,
    'current_period_end', p_period_end,
    'canceled_at', p_canceled_at,
    'ended_at', v_ended
  );

  select * into v_row
    from public.study_hall_365_subscriptions
   where stripe_subscription_id = p_stripe_subscription_id
   for update;

  if v_row.id is not null then
    v_previous := jsonb_build_object(
      'status', v_row.status,
      'cancel_at_period_end', v_row.cancel_at_period_end,
      'current_period_start', v_row.current_period_start,
      'current_period_end', v_row.current_period_end,
      'canceled_at', v_row.canceled_at,
      'ended_at', v_row.ended_at
    );

    if coalesce(p_event_created, 0) < coalesce(v_row.last_stripe_event_created, 0) then
      insert into public.financial_audit_log (actor_id, action, entity_type, entity_id, previous_state, new_state, reason)
      values (
        null, 'study_hall_365_stale_event', 'study_hall_365_subscriptions', v_row.id,
        jsonb_build_object('last_stripe_event_created', v_row.last_stripe_event_created, 'last_stripe_event_id', v_row.last_stripe_event_id),
        jsonb_build_object('ignored_event_created', p_event_created, 'ignored_event_id', p_event_id),
        'stale Stripe event ignored'
      );
      return jsonb_build_object(
        'status', 'skipped_stale',
        'id', v_row.id,
        'account_id', v_row.account_id,
        'previous', v_previous,
        'current', v_previous
      );
    end if;

    update public.study_hall_365_subscriptions
       set stripe_customer_id = p_stripe_customer_id,
           stripe_price_id = coalesce(p_stripe_price_id, stripe_price_id),
           stripe_latest_invoice_id = coalesce(p_latest_invoice_id, stripe_latest_invoice_id),
           checkout_payment_id = coalesce(p_payment_id, checkout_payment_id),
           status = v_status,
           current_period_start = p_period_start,
           current_period_end = p_period_end,
           cancel_at_period_end = coalesce(p_cancel_at_period_end, false),
           canceled_at = p_canceled_at,
           ended_at = v_ended,
           last_stripe_event_id = coalesce(p_event_id, last_stripe_event_id),
           last_stripe_event_created = coalesce(p_event_created, last_stripe_event_created)
     where id = v_row.id;

    return jsonb_build_object(
      'status', 'updated',
      'id', v_row.id,
      'account_id', v_row.account_id,
      'previous', v_previous,
      'current', v_current
    );
  end if;

  insert into public.study_hall_365_subscriptions (
    account_id, stripe_customer_id, stripe_subscription_id, stripe_price_id,
    stripe_latest_invoice_id, checkout_payment_id, status,
    current_period_start, current_period_end, cancel_at_period_end,
    canceled_at, ended_at, last_stripe_event_id, last_stripe_event_created
  ) values (
    p_account, p_stripe_customer_id, p_stripe_subscription_id, p_stripe_price_id,
    p_latest_invoice_id, p_payment_id, v_status,
    p_period_start, p_period_end, coalesce(p_cancel_at_period_end, false),
    p_canceled_at, v_ended, p_event_id, coalesce(p_event_created, 0)
  )
  returning * into v_row;

  return jsonb_build_object(
    'status', 'inserted',
    'id', v_row.id,
    'account_id', v_row.account_id,
    'previous', null,
    'current', v_current
  );
exception
  when unique_violation then
    raise exception 'This household already has a Study Hall 365 membership';
end;
$$;

revoke all on function public.upsert_study_hall_365_subscription(
  uuid, text, text, text, text, timestamptz, timestamptz, boolean, timestamptz, timestamptz, text, text, integer, uuid
) from public;
grant execute on function public.upsert_study_hall_365_subscription(
  uuid, text, text, text, text, timestamptz, timestamptz, boolean, timestamptz, timestamptz, text, text, integer, uuid
) to service_role;
