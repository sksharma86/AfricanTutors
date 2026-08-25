export function prepaidCoversDuration(
  balanceMinutes: number | null | undefined,
  durationMinutes: number,
): boolean;

export function durationOptionPriceLabel(
  balanceMinutes: number | null | undefined,
  durationMinutes: number,
  cashPriceLabel: string,
): string;

export function isFullyPrepaidQuote(
  quote: { package_minutes_used?: number; stripe_cents_due?: number } | null | undefined,
): boolean;

export function remainingBalanceMinutes(
  balanceMinutes: number | null | undefined,
  packageMinutesUsed: number | null | undefined,
): number;
