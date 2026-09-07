-- =============================================================================
-- 0041 — durable Plan My Week Change replacement, finalized after payment
-- =============================================================================
-- 0040 is the 365 same-day funding fallback. This is a separate contract:
-- when a new booking is created as a replacement for an existing session,
-- persist bookings.replaces_booking_id. After the NEW booking is confirmed
-- (immediately, or via fulfill_booking_payment after Stripe), cancel the OLD
-- booking with the existing customer-cancellation economics.
--
-- PAYG Change must not cancel the old session merely because checkout exists.
-- Abandoned / expired / failed replacement holds leave the original intact.
-- Duplicate fulfillment is idempotent. An already-cancelled old booking does
-- not fail new-booking fulfillment.
--
-- Does not change book_session pricing, 365 consume, or ordinary (non-Change)
-- PAYG checkout.
-- =============================================================================

alter table public.bookings
  add column if not exists replaces_booking_id uuid references public.bookings (id) on delete set null;

create index if not exists bookings_replaces_booking_id_idx
  on public.bookings (replaces_booking_id)
  where replaces_booking_id is not null;

-- Persist “new booking X replaces old booking Y” from the parent session.
create or replace function public.attach_booking_replacement(
  p_new_booking uuid,
  p_old_booking uuid
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_caller uuid := auth.uid();
  v_new public.bookings;
  v_old public.bookings;
begin
  if p_new_booking is null or p_old_booking is null then
    raise exception 'Replacement bookings are required';
  end if;
  if p_new_booking = p_old_booking then
    raise exception 'A session cannot replace itself';
  end if;

  select * into v_new from public.bookings where id = p_new_booking for update;
  select * into v_old from public.bookings where id = p_old_booking for update;

  if v_new.id is null or v_old.id is null then
    raise exception 'Booking not found';
  end if;
  if v_new.account_id is distinct from v_old.account_id then
    raise exception 'Not authorized to replace this session';
  end if;
  if v_caller is not null and v_caller is distinct from v_new.account_id and not public.is_admin(v_caller) then
    raise exception 'Not authorized';
  end if;
  if v_old.status not in ('pending', 'confirmed') then
    raise exception 'The current session is no longer scheduled';
  end if;
  if v_new.status not in ('pending', 'confirmed') then
    raise exception 'The new session is not awaiting confirmation';
  end if;
  if v_new.replaces_booking_id is not null and v_new.replaces_booking_id is distinct from p_old_booking then
    raise exception 'This session already replaces a different booking';
  end if;

  update public.bookings
     set replaces_booking_id = p_old_booking
   where id = p_new_booking;

  return jsonb_build_object(
    'status', 'attached',
    'booking_id', p_new_booking,
    'replaces_booking_id', p_old_booking
  );
end;
$$;

-- Cancel the replaced session using existing customer-cancel economics.
-- Safe to call after confirmation, on webhook replay, and when the old
-- booking is already cancelled.
create or replace function public.finalize_booking_replacement(p_new_booking uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_caller uuid := auth.uid();
  v_new public.bookings;
  v_old public.bookings;
  v_pay record;
  v_early boolean;
  v_res jsonb := '{}'::jsonb;
  v_credit_restored int := 0;
begin
  if p_new_booking is null then
    return jsonb_build_object('status', 'noop');
  end if;

  select * into v_new from public.bookings where id = p_new_booking;
  if v_new.id is null then
    return jsonb_build_object('status', 'noop');
  end if;
  if v_caller is not null and v_caller is distinct from v_new.account_id and not public.is_admin(v_caller) then
    raise exception 'Not authorized';
  end if;
  if v_new.status not in ('confirmed', 'completed') then
    return jsonb_build_object('status', 'not_confirmed', 'booking_id', v_new.id);
  end if;
  if v_new.replaces_booking_id is null then
    return jsonb_build_object('status', 'noop', 'booking_id', v_new.id);
  end if;

  select * into v_old from public.bookings where id = v_new.replaces_booking_id for update;
  if v_old.id is null then
    return jsonb_build_object('status', 'missing_original', 'booking_id', v_new.id);
  end if;
  if v_old.account_id is distinct from v_new.account_id then
    return jsonb_build_object('status', 'noop', 'booking_id', v_new.id);
  end if;
  if v_old.status not in ('pending', 'confirmed') then
    return jsonb_build_object(
      'status', 'already_cancelled',
      'booking_id', v_new.id,
      'replaced_booking_id', v_old.id,
      'booking_status', v_old.status::text
    );
  end if;

  -- Same rules as customer_cancel_booking (0027), without requiring auth.uid()
  -- so Stripe webhook fulfillment can finalize a parent-initiated Change.
  v_early := (v_old.scheduled_start is null) or (v_old.scheduled_start - now() >= interval '24 hours');

  select * into v_pay
    from public.payments
   where booking_id = v_old.id
     and status = 'requires_payment'
   order by created_at desc
   limit 1
   for update;

  if v_pay.id is not null then
    if coalesce(v_pay.credit_applied_cents, 0) > 0 then
      insert into public.dollar_credit_ledger (
        account_id, amount_cents, entry_type, payment_id, booking_id, reason, reference, created_by
      ) values (
        v_pay.account_id,
        v_pay.credit_applied_cents,
        'restoration',
        v_pay.id,
        v_old.id,
        'replacement — reserved credit restored',
        'restore:' || v_pay.id::text,
        v_caller
      )
      on conflict (reference) do nothing;
      v_credit_restored := v_pay.credit_applied_cents;
    end if;

    update public.payments
       set status = 'canceled',
           note = coalesce(note, 'replaced by a confirmed session')
     where id = v_pay.id;

    update public.bookings
       set status = 'cancelled',
           cancelled_at = coalesce(cancelled_at, now()),
           payment_hold_expires_at = null,
           payment_status = 'canceled'
     where id = v_old.id;

    return jsonb_build_object(
      'status', 'cancelled',
      'booking_id', v_new.id,
      'replaced_booking_id', v_old.id,
      'early', true,
      'restored_credit_cents', v_credit_restored,
      'restored_minutes', 0
    );
  end if;

  if v_early then
    v_res := public.restore_booking_value(v_old.id, 'customer cancellation 24h+ — value restored');
    update public.bookings
       set status = 'cancelled', cancelled_at = coalesce(cancelled_at, now())
     where id = v_old.id;
  else
    update public.bookings
       set status = 'cancelled', cancelled_at = coalesce(cancelled_at, now())
     where id = v_old.id;
    if to_regprocedure('public.try_full_earning(uuid,text)') is not null then
      perform public.try_full_earning(v_old.id, 'late customer cancellation (<24h) — full tutor compensation');
    end if;
    v_res := jsonb_build_object('restored', 0);
  end if;

  return jsonb_build_object(
    'status', 'cancelled',
    'booking_id', v_new.id,
    'replaced_booking_id', v_old.id,
    'early', v_early
  ) || v_res;
end;
$$;

-- Confirm Stripe payment, then finalize any persisted replacement. Expired /
-- credited payments must not cancel the original session.
create or replace function public.fulfill_booking_payment(
  p_payment_id uuid, p_amount_cents integer default null, p_charge_id text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_pay record;
  v_bk record;
  v_expected int;
  v_paid int;
  v_expired boolean;
  v_result jsonb;
begin
  if not public.is_financial_actor() then raise exception 'Not authorized'; end if;

  select * into v_pay from public.payments where id = p_payment_id for update;
  if v_pay.id is null then raise exception 'Payment not found'; end if;
  if v_pay.purpose <> 'booking' then raise exception 'Not a booking payment'; end if;
  if v_pay.status = 'succeeded' then
    v_result := public.finalize_booking_replacement(v_pay.booking_id);
    return jsonb_build_object(
      'status', 'already_fulfilled',
      'booking_id', v_pay.booking_id,
      'replacement', v_result
    );
  end if;

  v_expected := v_pay.gross_cents - v_pay.credit_applied_cents;
  if p_amount_cents is not null and p_amount_cents <> v_expected then
    raise exception 'Payment amount mismatch (expected %, got %)', v_expected, p_amount_cents;
  end if;
  v_paid := coalesce(p_amount_cents, v_expected);

  select * into v_bk from public.bookings where id = v_pay.booking_id for update;

  v_expired :=
       (v_pay.expires_at is not null and v_pay.expires_at <= now())
    or (v_pay.status in ('canceled', 'failed'))
    or (v_bk.id is null)
    or (v_bk.payment_hold_expires_at is not null and v_bk.payment_hold_expires_at <= now()
        and v_bk.status not in ('confirmed', 'completed'))
    or (v_bk.status in ('expired', 'cancelled'));

  if not v_expired and v_bk.id is not null and v_bk.status = 'pending' and v_bk.payment_status = 'awaiting_payment' then
    update public.bookings
       set status = 'confirmed', payment_status = 'paid', payment_hold_expires_at = null
     where id = v_bk.id;
    update public.payments
       set status = 'succeeded', stripe_paid_cents = v_paid, stripe_charge_id = coalesce(p_charge_id, stripe_charge_id), fulfilled_at = now()
     where id = p_payment_id;
    v_result := public.finalize_booking_replacement(v_bk.id);
    return jsonb_build_object('status', 'confirmed', 'booking_id', v_bk.id, 'replacement', v_result);
  end if;

  if not v_expired and v_bk.id is not null and v_bk.status in ('confirmed', 'completed') then
    update public.payments
       set status = 'succeeded', stripe_paid_cents = v_paid, stripe_charge_id = coalesce(p_charge_id, stripe_charge_id), fulfilled_at = now()
     where id = p_payment_id;
    v_result := public.finalize_booking_replacement(v_bk.id);
    return jsonb_build_object('status', 'confirmed', 'booking_id', v_bk.id, 'replacement', v_result);
  end if;

  if v_bk.id is not null and v_bk.status = 'pending' then
    update public.bookings set status = 'expired', payment_hold_expires_at = null where id = v_bk.id;
  end if;
  if v_pay.credit_applied_cents > 0 then
    insert into public.dollar_credit_ledger (account_id, amount_cents, entry_type, payment_id, booking_id, reason, reference, created_by)
      values (v_pay.account_id, v_pay.credit_applied_cents, 'restoration', p_payment_id, v_pay.booking_id, 'reserved credit released (booking unavailable)', 'restore:' || p_payment_id::text, null)
      on conflict (reference) do nothing;
  end if;
  insert into public.dollar_credit_ledger (account_id, amount_cents, entry_type, payment_id, booking_id, reason, reference, created_by)
    values (v_pay.account_id, v_paid, 'issuance', p_payment_id, v_pay.booking_id, 'payment received after slot unavailable; value credited', 'delayed:' || p_payment_id::text, null)
    on conflict (reference) do nothing;
  update public.payments
     set status = 'succeeded', stripe_paid_cents = v_paid, stripe_charge_id = coalesce(p_charge_id, stripe_charge_id), fulfilled_at = now(),
         note = 'Booking slot no longer available; payment credited to account balance.'
   where id = p_payment_id;
  return jsonb_build_object('status', 'credited', 'booking_id', v_pay.booking_id, 'credited_cents', v_paid);
end;
$$;

revoke all on function public.attach_booking_replacement(uuid, uuid) from public;
revoke all on function public.attach_booking_replacement(uuid, uuid) from anon;
grant execute on function public.attach_booking_replacement(uuid, uuid) to authenticated, service_role;

revoke all on function public.finalize_booking_replacement(uuid) from public;
revoke all on function public.finalize_booking_replacement(uuid) from anon;
grant execute on function public.finalize_booking_replacement(uuid) to authenticated, service_role;

revoke all on function public.fulfill_booking_payment(uuid, integer, text) from public;
grant execute on function public.fulfill_booking_payment(uuid, integer, text) to authenticated, service_role;

notify pgrst, 'reload schema';
