/**
 * Pure economics for prepaid Study Hall packages (unit-testable).
 * Standard rate is the 60-minute pay-as-you-go price ($12/hr => 1200 cents/hr).
 */
export const STANDARD_HOURLY_CENTS = 1200;

/** Catalog codes for the active Study Hall PR2 packages. */
export const PACKAGE_CODE_14H = "pkg_14h";
export const PACKAGE_CODE_28H = "pkg_28h";

/** Minutes / list prices for new purchases (cents). */
export const PACKAGE_14H_MINUTES = 840;
export const PACKAGE_14H_PRICE_CENTS = 14000;
export const PACKAGE_28H_MINUTES = 1680;
export const PACKAGE_28H_PRICE_CENTS = 25200;

/**
 * @param {number} minutes package minutes
 * @param {number} priceCents package price in cents
 * @param {number} [standardHourlyCents]
 * @returns {{ hours: number, effectiveHourlyCents: number, standardCents: number, savingsCents: number }}
 */
export function packageEconomics(minutes, priceCents, standardHourlyCents = STANDARD_HOURLY_CENTS) {
  const hours = (Number(minutes) || 0) / 60;
  const price = Number(priceCents) || 0;
  const effectiveHourlyCents = hours > 0 ? Math.round(price / hours) : 0;
  const standardCents = Math.round(hours * standardHourlyCents);
  const savingsCents = Math.max(0, standardCents - price);
  return { hours, effectiveHourlyCents, standardCents, savingsCents };
}

/**
 * Customer-facing badge for active package SKUs.
 * @param {number} minutes
 * @returns {"MOST POPULAR" | "BEST VALUE" | null}
 */
export function packageBadge(minutes) {
  if (Number(minutes) === PACKAGE_14H_MINUTES) return "MOST POPULAR";
  if (Number(minutes) === PACKAGE_28H_MINUTES) return "BEST VALUE";
  return null;
}
