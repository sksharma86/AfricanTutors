-- PR8B: stop selling obsolete prepaid SKUs as current customer offers.
--
-- Current customer prepaid product is pkg_10sh ($100 / 600 minutes / 10 one-hour
-- Study Halls; hours never expire).
--
-- pkg_14h and pkg_28h remain in package_products and in every historical ledger
-- row. Existing balances stay usable through the existing prepaid consumption
-- path. This migration only flips is_active so purchase_package / Hours UI
-- cannot treat them as new offers.
--
-- Do NOT delete rows. Do NOT rewrite ledgers. Do NOT expire remaining minutes.
-- Do NOT apply this to production until the PR8B cutover is approved.

update public.package_products
   set is_active = false,
       updated_at = now()
 where code in ('pkg_14h', 'pkg_28h')
   and is_active = true;

comment on table public.package_products is
  'Prepaid catalog. Current customer offer is pkg_10sh. pkg_14h/pkg_28h are historical; remaining purchased minutes remain usable.';
