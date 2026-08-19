-- =============================================================================
-- African Tutors — Phase 4B lifecycle hardening (on top of 0007)
-- =============================================================================
-- Fixes two payment-lifecycle gaps found in review:
--
-- 1. Internal payment expiry is now authoritative for BOTH bookings and
--    packages via payments.expires_at (packages have no booking hold to key on).
--    African Tutors internal hold stays 15 minutes; the Stripe Checkout Session
--    lifetime is separate (>= Stripe's 30-min minimum, set in the app layer).
--
-- 2. Reserved dollar credit can no longer be stranded:
--    * abandoned/expired package checkouts release credit + cancel the payment
--      (release_expired_checkouts) and never issue minutes;
--    * a failed Stripe Checkout creation after a DB reservation is rolled back
--      immediately (cancel_pending_payment) for bookings AND packages;
--    * a late Stripe success after internal expiry follows the same
--      delayed-payment policy as bookings: the value becomes account credit and
--      the original transaction is NOT resurrected.
--
-- All restoration is idempotent (unique ledger references). Idempotent migration.
-- =============================================================================

-- Authoritative internal expiry for a pending (requires_payment) checkout.
alter table public.payments add column if not exists expires_at timestamptz;
create index if not exists payments_pending_expiry_idx
  on public.payments (expires_at) where status = 'requires_payment';

-- ---------------------------------------------------------------------------
-- book_session — unchanged behavior EXCEPT the Stripe/mixed payment now records
-- an authoritative expires_at (15 min), matching the booking hold.
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
  v_hold constant interval := interval '15 minutes';
begin
  select account_id into v_account from public.students where id = p_student_id;
  if v_account is null then raise exception 'Student not found'; end if;
  if v_caller is not null and v_caller is distinct from v_account and not public.is_admin(v_caller) then
    raise exception 'Not authorized to book for this student';
  end if;

  perform public.release_expired_holds();

  if p_duration not in (30, 60) then raise exception 'Invalid duration'; end if;

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

-- ---------------------------------------------------------------------------
-- purchase_package — Stripe path now records an authoritative expires_at so an
-- abandoned package checkout can be swept and its reserved credit restored.
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
  v_hold constant interval := interval '15 minutes';
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

  insert into public.payments (account_id, purpose, package_product_id, gross_cents, stripe_paid_cents, credit_applied_cents, status, fulfilled_at, expires_at)
    values (v_account, 'package', v_prod.id, v_prod.price_cents, 0, v_credit_used,
            case when v_stripe_due = 0 then 'succeeded' else 'requires_payment' end,
            case when v_stripe_due = 0 then now() else null end,
            case when v_stripe_due = 0 then null else now() + v_hold end)
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
-- cancel_pending_payment — explicit, idempotent rollback of a still-pending
-- (requires_payment) checkout. Used when Stripe Checkout creation fails/aborts
-- after a DB reservation, and by the sweeper for expired package checkouts.
-- Restores reserved credit, cancels the payment, and (for bookings) expires the
-- booking so the tutor slot is released. No-op once the payment is terminal.
-- ---------------------------------------------------------------------------
create or replace function public.cancel_pending_payment(p_payment_id uuid, p_reason text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_pay record;
begin
  if not public.is_financial_actor() then raise exception 'Not authorized'; end if;
  select * into v_pay from public.payments where id = p_payment_id for update;
  if v_pay.id is null then raise exception 'Payment not found'; end if;
  if v_pay.status <> 'requires_payment' then
    return jsonb_build_object('status', 'noop', 'payment_status', v_pay.status);
  end if;

  if v_pay.credit_applied_cents > 0 then
    insert into public.dollar_credit_ledger (account_id, amount_cents, entry_type, payment_id, booking_id, reason, reference, created_by)
      values (v_pay.account_id, v_pay.credit_applied_cents, 'restoration', p_payment_id, v_pay.booking_id,
              coalesce(p_reason, 'checkout canceled; reserved credit restored'), 'restore:' || p_payment_id::text, null)
      on conflict (reference) do nothing;
  end if;

  if v_pay.purpose = 'booking' and v_pay.booking_id is not null then
    update public.bookings set status = 'expired', payment_hold_expires_at = null
     where id = v_pay.booking_id and status = 'pending' and payment_status = 'awaiting_payment';
  end if;

  update public.payments set status = 'canceled', note = coalesce(p_reason, 'checkout canceled') where id = p_payment_id;
  return jsonb_build_object('status', 'canceled');
end;
$$;

-- ---------------------------------------------------------------------------
-- release_expired_checkouts — unified sweeper. Releases expired booking holds
-- (via release_expired_holds) AND expired package checkouts (keyed off
-- payments.expires_at, since a package has no booking). Safe to run on a
-- schedule; idempotent.
-- ---------------------------------------------------------------------------
create or replace function public.release_expired_checkouts()
returns integer
language plpgsql security definer set search_path = public as $$
declare v_count integer := 0; p record;
begin
  if not public.is_financial_actor() then raise exception 'Not authorized'; end if;

  v_count := public.release_expired_holds();

  for p in
    select id from public.payments
     where status = 'requires_payment' and purpose = 'package'
       and expires_at is not null and expires_at < now()
     for update skip locked
  loop
    perform public.cancel_pending_payment(p.id, 'package checkout expired');
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- fulfill_package_payment — now also handles a LATE Stripe success that arrives
-- after the internal package reservation already expired/canceled. In that case
-- the package is NOT resurrected: reserved credit is restored (idempotent) and
-- the Stripe-paid amount is credited to the account balance. Minutes are issued
-- exactly once and ONLY on the normal (still-pending) path.
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

  -- Late payment after the internal package reservation expired: credit, no minutes.
  if v_pay.status in ('canceled', 'failed') then
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

  -- Normal path: still pending → issue minutes exactly once.
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
-- Grants
-- ---------------------------------------------------------------------------
do $$
declare fn text;
begin
  for fn in select unnest(array[
    'book_session(uuid,uuid,text,text,integer,timestamptz,boolean)',
    'purchase_package(uuid,uuid)',
    'cancel_pending_payment(uuid,text)',
    'release_expired_checkouts()',
    'fulfill_package_payment(uuid,integer,text)'
  ]) loop
    execute format('revoke all on function public.%s from public', fn);
    execute format('grant execute on function public.%s to authenticated, service_role', fn);
  end loop;
end $$;

notify pgrst, 'reload schema';
