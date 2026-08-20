export const STANDARD_HOURLY_CENTS: number;
export function packageEconomics(
  minutes: number,
  priceCents: number,
  standardHourlyCents?: number,
): { hours: number; effectiveHourlyCents: number; standardCents: number; savingsCents: number };
