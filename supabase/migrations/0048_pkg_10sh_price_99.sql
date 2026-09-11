-- pkg_10sh list price $100 → $99 (9900 cents).
-- New purchases read this row through purchase_package → stripe_cents_due.
-- Existing payments, ledgers, and already-purchased minutes are untouched.
--
-- Do NOT apply this migration to production until this change is approved to merge.

update public.package_products
set price_cents = 9900
where code = 'pkg_10sh'
  and price_cents = 10000;

comment on table public.package_products is
  'Prepaid catalog. Current customer offer is pkg_10sh ($99 / 600 minutes / 10 one-hour Study Halls). pkg_14h/pkg_28h are historical; remaining purchased minutes remain usable.';
