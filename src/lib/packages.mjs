/**
 * Pure economics for prepaid tutoring packages (unit-testable).
 * Standard rate is the 60-minute session price ($20/hr => 2000 cents/hr).
 */
export const STANDARD_HOURLY_CENTS = 2000;

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
