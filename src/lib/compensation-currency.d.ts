export const COMPENSATION_CURRENCIES: readonly string[];
export function normalizeCompensationCurrency(code: string | null | undefined): string | null;
export function isSupportedCompensationCurrency(code: string | null | undefined): boolean;
export function formatCompensationMinor(minorUnits: number, currency: string | null | undefined): string;
export function formatCompensationHourly(minorUnits: number, currency: string | null | undefined): string;
export function aggregateCompensationByCurrency(
  rows: { amount_cents: number; status: string; currency?: string | null }[],
): { currency: string; earned: number; paid: number; outstanding: number }[];
export function formatCompensationTotals(
  totals: { currency: string; earned: number; paid: number; outstanding: number }[],
  field: "earned" | "paid" | "outstanding",
): string;
export function summarizeGuideCompensation(
  guides: { profile_id: string; name: string; rate_cents?: number | null; currency?: string | null }[],
  earnings: { tutor_id: string; amount_cents: number; status: string; currency?: string | null }[],
): {
  profile_id: string;
  name: string;
  rate_cents: number | null;
  currency: string;
  totals: { currency: string; earned: number; paid: number; outstanding: number }[];
}[];
