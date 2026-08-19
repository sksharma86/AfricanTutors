-- =============================================================================
-- African Tutors — Phase 4B: self-enforcing payment expiry at fulfillment
-- =============================================================================
-- Previously, expiry only took effect if release_expired_checkouts()/
-- release_expired_holds() happened to run before a Stripe webhook. A late Stripe
-- payment (paid after the 15-min internal deadline but before the Stripe session
-- lapsed) could therefore confirm a booking / issue package minutes if no sweeper
-- had run yet — the timestamp was not truly authoritative.
--
-- This migration makes the authoritative deadline SELF-ENFORCING inside the
-- fulfillment functions, while the payment/booking rows are locked. A timestamp
-- in the past now expires the transaction regardless of whether a sweeper has
-- updated the row yet. The sweeper (release_expired_checkouts) remains a useful
-- proactive cleanup but is no longer required for correctness.
--
-- Race safety: fulfillment locks the payment row (FOR UPDATE); the sweeper's
-- cancel_pending_payment locks the same row. Whoever wins does its work first;
-- the loser sees a terminal/expired state and no-ops. Reserved-credit restoration
-- and delayed-credit issuance use unique ledger references
-- ('restore:<payment_id>', 'delayed:<payment_id>') so value moves exactly once.
--
-- Idempotent.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- fulfill_booking_payment — confirm ONLY if not expired; otherwise delayed-credit.
-- ---------------------------------------------------------------------------
create or replace function public.fulfill_booking_payment(
  p_payment_id uuid, p_amount_cents integer default null, p_charge_id text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_pay record; v_bk record; v_expected int; v_paid int; v_expired boolean;
begin
  if not public.is_financial_actor() then raise exception 'Not authorized'; end if;

  select * into v_pay from public.payments where id = p_payment_id for update;
  if v_pay.id is null then raise exception 'Payment not found'; end if;
  if v_pay.purpose <> 'booking' then raise exception 'Not a booking payment'; end if;
  if v_pay.status = 'succeeded' then
    return jsonb_build_object('status', 'already_fulfilled', 'booking_id', v_pay.booking_id);
  end if;

  v_expected := v_pay.gross_cents - v_pay.credit_applied_cents;
  if p_amount_cents is not null and p_amount_cents <> v_expected then
    raise exception 'Payment amount mismatch (expected %, got %)', v_expected, p_amount_cents;
  end if;
  v_paid := coalesce(p_amount_cents, v_expected);

  select * into v_bk from public.bookings where id = v_pay.booking_id for update;

  -- Authoritative expiry check — true if EITHER internal deadline has passed, or
  -- the payment/booking has already been swept to a terminal/expired state, or
  -- the booking no longer exists.
  v_expired :=
       (v_pay.expires_at is not null and v_pay.expires_at <= now())
    or (v_pay.status in ('canceled', 'failed'))
    or (v_bk.id is null)
    or (v_bk.payment_hold_expires_at is not null and v_bk.payment_hold_expires_at <= now()
        and v_bk.status not in ('confirmed', 'completed'))
    or (v_bk.status in ('expired', 'cancelled'));

  -- Not expired and still awaiting → confirm the booking.
  if not v_expired and v_bk.id is not null and v_bk.status = 'pending' and v_bk.payment_status = 'awaiting_payment' then
    update public.bookings
       set status = 'confirmed', payment_status = 'paid', payment_hold_expires_at = null
     where id = v_bk.id;
    update public.payments
       set status = 'succeeded', stripe_paid_cents = v_paid, stripe_charge_id = coalesce(p_charge_id, stripe_charge_id), fulfilled_at = now()
     where id = p_payment_id;
    return jsonb_build_object('status', 'confirmed', 'booking_id', v_bk.id);
  end if;

  -- Not expired and already confirmed/completed → mark payment succeeded (idempotent).
  if not v_expired and v_bk.id is not null and v_bk.status in ('confirmed', 'completed') then
    update public.payments
       set status = 'succeeded', stripe_paid_cents = v_paid, stripe_charge_id = coalesce(p_charge_id, stripe_charge_id), fulfilled_at = now()
     where id = p_payment_id;
    return jsonb_build_object('status', 'confirmed', 'booking_id', v_bk.id);
  end if;

  -- Expired (by timestamp even if unswept) → delayed payment: never resurrect the
  -- slot. Ensure the booking is released, restore reserved credit, and credit the
  -- Stripe amount. All idempotent.
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

-- ---------------------------------------------------------------------------
-- fulfill_package_payment — issue minutes ONLY if not expired; otherwise credit.
-- ---------------------------------------------------------------------------
create or replace function public.fulfill_package_payment(
  p_payment_id uuid, p_amount_cents integer default null, p_charge_id text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_pay record; v_minutes int; v_expected int; v_paid int; v_expired boolean;
begin
  if not public.is_financial_actor() then raise exception 'Not authorized'; end if;

  select * into v_pay from public.payments where id = p_payment_id for update;
  if v_pay.id is null then raise exception 'Payment not found'; end if;
  if v_pay.purpose <> 'package' then raise exception 'Not a package payment'; end if;
  if v_pay.status = 'succeeded' then
    return jsonb_build_object('status', 'already_fulfilled');
  end if;

  v_expected := v_pay.gross_cents - v_pay.credit_applied_cents;
  if p_amount_cents is not null and p_amount_cents <> v_expected then
    raise exception 'Payment amount mismatch (expected %, got %)', v_expected, p_amount_cents;
  end if;
  v_paid := coalesce(p_amount_cents, v_expected);

  -- Authoritative expiry: past internal deadline OR already swept to terminal.
  v_expired :=
       (v_pay.expires_at is not null and v_pay.expires_at <= now())
    or (v_pay.status in ('canceled', 'failed'));

  if v_expired then
    if v_pay.credit_applied_cents > 0 then
      insert into public.dollar_credit_ledger (account_id, amount_cents, entry_type, payment_id, reason, reference, created_by)
        values (v_pay.account_id, v_pay.credit_applied_cents, 'restoration', p_payment_id, 'reserved credit released (package checkout expired)', 'restore:' || p_payment_id::text, null)
        on conflict (reference) do nothing;
    end if;
    insert into public.dollar_credit_ledger (account_id, amount_cents, entry_type, payment_id, reason, reference, created_by)
      values (v_pay.account_id, v_paid, 'issuance', p_payment_id, 'package payment received after checkout expired; value credited', 'delayed:' || p_payment_id::text, null)
      on conflict (reference) do nothing;
    update public.payments
       set status = 'succeeded', stripe_paid_cents = v_paid, stripe_charge_id = coalesce(p_charge_id, stripe_charge_id), fulfilled_at = now(),
           note = 'Package checkout expired before payment; amount credited to account balance.'
     where id = p_payment_id;
    return jsonb_build_object('status', 'credited', 'credited_cents', v_paid);
  end if;

  -- Not expired → issue minutes exactly once.
  select minutes into v_minutes from public.package_products where id = v_pay.package_product_id;
  if v_minutes is null then raise exception 'Package product not found'; end if;

  insert into public.package_minute_ledger (account_id, minutes_delta, entry_type, payment_id, package_product_id, reason, reference, created_by)
    values (v_pay.account_id, v_minutes, 'purchase', p_payment_id, v_pay.package_product_id, 'package purchase (Stripe)', 'pkgissue:' || p_payment_id::text, null)
    on conflict (reference) do nothing;

  update public.payments
     set status = 'succeeded', stripe_paid_cents = v_paid, stripe_charge_id = coalesce(p_charge_id, stripe_charge_id), fulfilled_at = now()
   where id = p_payment_id;

  return jsonb_build_object('status', 'completed', 'minutes', v_minutes);
end;
$$;

do $$
declare fn text;
begin
  for fn in select unnest(array[
    'fulfill_booking_payment(uuid,integer,text)',
    'fulfill_package_payment(uuid,integer,text)'
  ]) loop
    execute format('revoke all on function public.%s from public', fn);
    execute format('grant execute on function public.%s to authenticated, service_role', fn);
  end loop;
end $$;

notify pgrst, 'reload schema';
