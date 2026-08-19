-- =============================================================================
-- African Tutors — Phase 4B: Customer checkout & payment fulfillment
-- =============================================================================
-- Connects the Phase 4A financial foundation to customer booking/package flows.
-- All money is INTEGER CENTS. Server-side pricing is authoritative; the client
-- never supplies an amount. Balances derive from the Phase 4A ledgers.
--
-- Payment funding priority for a paid booking (authoritative):
--   1. If package minutes cover the ENTIRE session  -> use package minutes.
--   2. Otherwise DO NOT touch package minutes at all.
--   3. Apply available dollar credit.
--   4. Charge the remainder through Stripe.
--
-- Credit-reservation strategy = CONSUME-AND-RESTORE. Partial dollar credit is
-- consumed immediately (a ledger 'consumption' linked to the payment) so it can
-- never be double-spent while a Stripe payment is outstanding. If the Stripe
-- payment fails or the 15-minute hold expires, the exact amount is restored via
-- an idempotent 'restoration' entry (reference 'restore:<payment_id>').
--
-- Payment record state model (payments.status):
--   internal-only paid booking (package/credit): created -> succeeded (atomic)
--   pending Stripe booking:                       requires_payment
--     -> succeeded (webhook)  |  canceled (hold expired / failed)
--   package purchase, credit-funded:              created -> succeeded (atomic)
--   package purchase, Stripe:                     requires_payment -> succeeded
--   delayed Stripe success after booking expiry:  requires_payment -> succeeded
--     (booking NOT reactivated; value moved to dollar credit)
--
-- Idempotent (safe to re-run).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Additive columns on payments for fulfillment bookkeeping.
-- ---------------------------------------------------------------------------
alter table public.payments add column if not exists fulfilled_at timestamptz;
alter table public.payments add column if not exists note text;

-- ---------------------------------------------------------------------------
-- get_customer_balances — convenience read for the checkout UI (owner/admin).
-- ---------------------------------------------------------------------------
create or replace function public.get_customer_balances(p_account uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is not null and auth.uid() <> p_account and not public.is_admin(auth.uid()) then
    raise exception 'Not authorized';
  end if;
  return jsonb_build_object(
    'package_minutes', coalesce((select sum(minutes_delta) from public.package_minute_ledger where account_id = p_account), 0),
    'dollar_credit_cents', coalesce((select sum(amount_cents) from public.dollar_credit_ledger where account_id = p_account), 0)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- booking_quote — authoritative, display-only pricing/funding breakdown.
-- The actual consumption in book_session recomputes this under locks, so a
-- stale quote can never be trusted to move money.
-- ---------------------------------------------------------------------------
create or replace function public.booking_quote(
  p_account uuid, p_duration integer, p_is_free_trial boolean default false
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_price int; v_pkg int; v_credit int; v_pkg_used int; v_credit_used int; v_due int;
begin
  if auth.uid() is not null and auth.uid() <> p_account and not public.is_admin(auth.uid()) then
    raise exception 'Not authorized';
  end if;
  if p_duration not in (30, 60) then raise exception 'Invalid duration'; end if;

  if p_is_free_trial then
    return jsonb_build_object(
      'session_price_cents', 0, 'is_free_trial', true,
      'package_minutes_used', 0, 'credit_cents_used', 0, 'stripe_cents_due', 0,
      'funding', 'free_trial');
  end if;

  v_price := case p_duration when 30 then 1200 when 60 then 2000 end;
  v_pkg := coalesce((select sum(minutes_delta) from public.package_minute_ledger where account_id = p_account), 0);
  v_credit := coalesce((select sum(amount_cents) from public.dollar_credit_ledger where account_id = p_account), 0);

  if v_pkg >= p_duration then
    v_pkg_used := p_duration; v_credit_used := 0; v_due := 0;
  else
    v_pkg_used := 0;
    v_credit_used := least(greatest(v_credit, 0), v_price);
    v_due := v_price - v_credit_used;
  end if;

  return jsonb_build_object(
    'session_price_cents', v_price, 'is_free_trial', false,
    'package_minutes_used', v_pkg_used, 'credit_cents_used', v_credit_used,
    'stripe_cents_due', v_due,
    'funding', case when v_pkg_used > 0 then 'package' when v_due = 0 then 'credit' else 'stripe' end,
    'available_package_minutes', v_pkg, 'available_credit_cents', greatest(v_credit, 0));
end;
$$;

-- ---------------------------------------------------------------------------
-- book_session — authoritative booking + funding orchestration.
--
-- Runs as SECURITY DEFINER but performs its OWN ownership check (caller must own
-- the student, or be admin/service). Because it is trusted after that check, it
-- writes the ledgers directly (inline, with the same advisory locks the Phase 4A
-- functions use) instead of the is_financial_actor-guarded helpers — a customer
-- must be able to spend THEIR OWN balance atomically as part of one booking tx.
--
-- The whole function body is a single transaction: if any step fails, the
-- booking, the payment, and any ledger movement all roll back together.
-- ---------------------------------------------------------------------------
create or replace function public.book_session(
  p_student_id uuid,
  p_subject_id uuid,
  p_other_subject text,
  p_request_note text,
  p_duration int,
  p_start timestamptz,
  p_is_free_trial boolean
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
begin
  select account_id into v_account from public.students where id = p_student_id;
  if v_account is null then raise exception 'Student not found'; end if;
  if v_caller is not null and v_caller is distinct from v_account and not public.is_admin(v_caller) then
    raise exception 'Not authorized to book for this student';
  end if;

  perform public.release_expired_holds();

  if p_duration not in (30, 60) then raise exception 'Invalid duration'; end if;

  -- ---- Free trial: $0, confirms through the existing free-trial path. --------
  if p_is_free_trial then
    if p_duration <> 30 then raise exception 'The free trial is 30 minutes only'; end if;
    v_booking_id := public.create_booking(
      p_student_id, p_subject_id, p_other_subject, p_request_note, 30, p_start, true);
    insert into public.payments (account_id, purpose, booking_id, gross_cents, stripe_paid_cents, credit_applied_cents, status, fulfilled_at)
      values (v_account, 'booking', v_booking_id, 0, 0, 0, 'succeeded', now())
      returning id into v_payment_id;
    select status::text into v_status from public.bookings where id = v_booking_id;
    return jsonb_build_object(
      'booking_id', v_booking_id, 'payment_id', v_payment_id, 'funding', 'free_trial',
      'session_price_cents', 0, 'package_minutes_used', 0, 'credit_cents_used', 0,
      'stripe_cents_due', 0, 'booking_status', v_status);
  end if;

  v_price := case p_duration when 30 then 1200 when 60 then 2000 end;

  -- ---- "Other" (no subject) → admin-triage request; no charge collected now. -
  if p_subject_id is null then
    v_booking_id := public.create_booking(
      p_student_id, null, p_other_subject, p_request_note, p_duration, null, false);
    insert into public.payments (account_id, purpose, booking_id, gross_cents, status)
      values (v_account, 'booking', v_booking_id, v_price, 'created')
      returning id into v_payment_id;
    return jsonb_build_object(
      'booking_id', v_booking_id, 'payment_id', v_payment_id, 'funding', 'request',
      'session_price_cents', v_price, 'package_minutes_used', 0, 'credit_cents_used', 0,
      'stripe_cents_due', 0, 'booking_status', 'pending');
  end if;

  -- ---- Funding decision (authoritative, under per-account locks) -------------
  -- Lock order is always package-minutes then dollar-credit to avoid deadlocks.
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

  -- Create the booking through the existing engine (pending + 15-min hold).
  v_booking_id := public.create_booking(
    p_student_id, p_subject_id, p_other_subject, p_request_note, p_duration, p_start, false);

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
    -- mixed credit + Stripe, or Stripe-only. Booking stays pending/awaiting_payment.
    insert into public.payments (account_id, purpose, booking_id, gross_cents, stripe_paid_cents, credit_applied_cents, status)
      values (v_account, 'booking', v_booking_id, v_price, 0, v_credit_used, 'requires_payment')
      returning id into v_payment_id;
    if v_credit_used > 0 then
      -- Reserve credit now (consume-and-restore); restored on expiry/failure.
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

-- ---------------------------------------------------------------------------
-- purchase_package — buy a package independently of a booking.
-- Package minutes are only issued once: immediately when credit fully funds it,
-- otherwise strictly on verified Stripe webhook success (fulfill_package_payment).
-- ---------------------------------------------------------------------------
create or replace function public.purchase_package(p_package_id uuid, p_account uuid default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_caller uuid := auth.uid();
  v_account uuid := coalesce(p_account, auth.uid());
  v_prod record;
  v_credit_bal int;
  v_credit_used int := 0;
  v_stripe_due int;
  v_payment_id uuid;
  v_funding text;
  v_status text;
begin
  if v_account is null then raise exception 'Account is required'; end if;
  if v_caller is not null and v_caller is distinct from v_account and not public.is_admin(v_caller) then
    raise exception 'Not authorized';
  end if;

  select id, minutes, price_cents, is_active into v_prod
  from public.package_products where id = p_package_id;
  if v_prod.id is null then raise exception 'Package not found'; end if;
  if not v_prod.is_active then raise exception 'Package is not available'; end if;

  perform pg_advisory_xact_lock(hashtext('dollar:' || v_account::text));
  v_credit_bal := coalesce((select sum(amount_cents) from public.dollar_credit_ledger where account_id = v_account), 0);
  v_credit_used := least(greatest(v_credit_bal, 0), v_prod.price_cents);
  v_stripe_due := v_prod.price_cents - v_credit_used;

  insert into public.payments (account_id, purpose, package_product_id, gross_cents, stripe_paid_cents, credit_applied_cents, status, fulfilled_at)
    values (v_account, 'package', v_prod.id, v_prod.price_cents, 0, v_credit_used,
            case when v_stripe_due = 0 then 'succeeded' else 'requires_payment' end,
            case when v_stripe_due = 0 then now() else null end)
    returning id into v_payment_id;

  if v_credit_used > 0 then
    insert into public.dollar_credit_ledger (account_id, amount_cents, entry_type, payment_id, reason, reference, created_by)
      values (v_account, -v_credit_used, 'consumption', v_payment_id,
              case when v_stripe_due = 0 then 'package purchase (account credit)' else 'credit reserved for package (awaiting Stripe)' end,
              'pkgbuy:' || v_payment_id::text || ':credit', v_caller);
  end if;

  if v_stripe_due = 0 then
    insert into public.package_minute_ledger (account_id, minutes_delta, entry_type, payment_id, package_product_id, reason, reference, created_by)
      values (v_account, v_prod.minutes, 'purchase', v_payment_id, v_prod.id, 'package purchase (account credit)', 'pkgissue:' || v_payment_id::text, v_caller);
    v_funding := 'credit'; v_status := 'completed';
  else
    v_funding := 'stripe'; v_status := 'requires_payment';
  end if;

  return jsonb_build_object(
    'payment_id', v_payment_id, 'package_product_id', v_prod.id, 'minutes', v_prod.minutes,
    'gross_cents', v_prod.price_cents, 'credit_cents_used', v_credit_used,
    'stripe_cents_due', v_stripe_due, 'funding', v_funding, 'status', v_status);
end;
$$;

-- ---------------------------------------------------------------------------
-- fulfill_booking_payment — webhook fulfillment for a Stripe booking payment.
-- Idempotent at BOTH the payment-object level (status guard) and the ledger
-- level (unique references). Handles the delayed-payment-after-expiry case
-- safely: value is moved to dollar credit; the expired slot is never overridden.
-- ---------------------------------------------------------------------------
create or replace function public.fulfill_booking_payment(
  p_payment_id uuid, p_amount_cents integer default null, p_charge_id text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_pay record; v_bk record; v_expected int; v_paid int;
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

  -- Booking still eligible → confirm it.
  if v_bk.id is not null and v_bk.status = 'pending' and v_bk.payment_status = 'awaiting_payment' then
    update public.bookings
       set status = 'confirmed', payment_status = 'paid', payment_hold_expires_at = null
     where id = v_bk.id;
    update public.payments
       set status = 'succeeded', stripe_paid_cents = v_paid, stripe_charge_id = coalesce(p_charge_id, stripe_charge_id), fulfilled_at = now()
     where id = p_payment_id;
    return jsonb_build_object('status', 'confirmed', 'booking_id', v_bk.id);
  end if;

  -- Booking already confirmed/completed → mark payment succeeded idempotently.
  if v_bk.id is not null and v_bk.status in ('confirmed', 'completed') then
    update public.payments
       set status = 'succeeded', stripe_paid_cents = v_paid, stripe_charge_id = coalesce(p_charge_id, stripe_charge_id), fulfilled_at = now()
     where id = p_payment_id;
    return jsonb_build_object('status', 'confirmed', 'booking_id', v_bk.id);
  end if;

  -- Delayed payment: booking expired/cancelled/gone. Never override the slot.
  -- Restore any reserved credit (idempotent) AND credit the Stripe amount paid,
  -- so the customer keeps 100% of the value as account credit.
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
-- fulfill_package_payment — webhook fulfillment for a Stripe package purchase.
-- Issues package minutes exactly once (unique reference 'pkgissue:<payment_id>').
-- ---------------------------------------------------------------------------
create or replace function public.fulfill_package_payment(
  p_payment_id uuid, p_amount_cents integer default null, p_charge_id text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_pay record; v_minutes int; v_expected int; v_paid int;
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

-- ---------------------------------------------------------------------------
-- release_expired_holds — now also releases reserved dollar credit and cancels
-- the pending payment when a paid-hold expires. Idempotent (restore reference
-- 'restore:<payment_id>'). Still called at the top of create_booking/book_session
-- and available to a scheduled job.
-- ---------------------------------------------------------------------------
create or replace function public.release_expired_holds()
returns integer
language plpgsql security definer set search_path = public as $$
declare v_count integer := 0; r record; p record;
begin
  for r in
    select id from public.bookings
     where status = 'pending'
       and payment_status = 'awaiting_payment'
       and payment_hold_expires_at is not null
       and payment_hold_expires_at < now()
     for update skip locked
  loop
    update public.bookings set status = 'expired' where id = r.id;

    for p in
      select id, account_id, credit_applied_cents
        from public.payments
       where booking_id = r.id and purpose = 'booking' and status = 'requires_payment'
       for update
    loop
      if p.credit_applied_cents > 0 then
        insert into public.dollar_credit_ledger (account_id, amount_cents, entry_type, payment_id, booking_id, reason, reference, created_by)
          values (p.account_id, p.credit_applied_cents, 'restoration', p.id, r.id, 'reserved credit released (payment hold expired)', 'restore:' || p.id::text, null)
          on conflict (reference) do nothing;
      end if;
      update public.payments set status = 'canceled', note = 'Payment hold expired; booking released.' where id = p.id;
    end loop;

    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants. book_session / purchase_package / quotes / balances are callable by
-- authenticated customers (each does its own ownership check). Fulfillment is
-- guarded by is_financial_actor (admin/service only) inside the function.
-- ---------------------------------------------------------------------------
do $$
declare fn text;
begin
  for fn in select unnest(array[
    'get_customer_balances(uuid)',
    'booking_quote(uuid,integer,boolean)',
    'book_session(uuid,uuid,text,text,integer,timestamptz,boolean)',
    'purchase_package(uuid,uuid)',
    'fulfill_booking_payment(uuid,integer,text)',
    'fulfill_package_payment(uuid,integer,text)',
    'release_expired_holds()'
  ]) loop
    execute format('revoke all on function public.%s from public', fn);
    execute format('grant execute on function public.%s to authenticated, service_role', fn);
  end loop;
end $$;

notify pgrst, 'reload schema';
