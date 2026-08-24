export const STANDARD_HOURLY_CENTS: number;
export const PACKAGE_CODE_14H: string;
export const PACKAGE_CODE_28H: string;
export const PACKAGE_14H_MINUTES: number;
export const PACKAGE_14H_PRICE_CENTS: number;
export const PACKAGE_28H_MINUTES: number;
export const PACKAGE_28H_PRICE_CENTS: number;
export function packageEconomics(
  minutes: number,
  priceCents: number,
  standardHourlyCents?: number,
): { hours: number; effectiveHourlyCents: number; standardCents: number; savingsCents: number };
export function packageBadge(minutes: number): "MOST POPULAR" | "BEST VALUE" | null;
