-- =============================================================================
-- African Tutors — Phase 4D: financial hardening
-- =============================================================================
-- Adds idempotency for duplicate package-checkout submissions so a double-click /
-- retry cannot create two pending package payments (two Stripe sessions) or
-- reserve dollar credit twice. Uses the existing per-account advisory lock so
-- concurrent duplicates serialize and the second reuses the first's pending
-- payment. (Booking checkout is already deduped by the tutor/slot exclusion
-- constraint; full-credit package purchases are already guarded by the advisory
-- lock + balance re-check.)  Idempotent migration.
-- =============================================================================

create or replace function public.purchase_package(p_package_id uuid, p_account uuid default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_caller uuid := auth.uid();
  v_account uuid := coalesce(p_account, auth.uid());
  v_prod record;
  v_existing record;
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

  -- Idempotency: reuse an existing OPEN (unexpired, awaiting-Stripe) package
  -- checkout for the same account+product rather than creating a duplicate.
  select id, gross_cents, credit_applied_cents into v_existing
  from public.payments
  where account_id = v_account and purpose = 'package' and package_product_id = v_prod.id
    and status = 'requires_payment' and (expires_at is null or expires_at > now())
  order by created_at desc limit 1;
  if v_existing.id is not null then
    return jsonb_build_object(
      'payment_id', v_existing.id, 'package_product_id', v_prod.id, 'minutes', v_prod.minutes,
      'gross_cents', v_existing.gross_cents, 'credit_cents_used', v_existing.credit_applied_cents,
      'stripe_cents_due', v_existing.gross_cents - v_existing.credit_applied_cents,
      'funding', 'stripe', 'status', 'requires_payment', 'deduped', true);
  end if;

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

revoke all on function public.purchase_package(uuid,uuid) from public;
grant execute on function public.purchase_package(uuid,uuid) to authenticated, service_role;

notify pgrst, 'reload schema';
