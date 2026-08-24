/**
 * Customer-facing formatting helpers (pure, unit-testable, browser-safe).
 * Keep human-readable — customers never see cents, minutes-as-ledger, or enums.
 */

/** Always two decimals, for balances/credit: 2400 -> "$24.00", 0 -> "$0.00". */
export function formatMoneyCents(cents) {
  const n = Number(cents) || 0;
  return `$${(n / 100).toFixed(2)}`;
}

/**
 * Human Study Hall time from minutes: 510 -> "8 hr 30 min", 60 -> "1 hr",
 * 30 -> "30 min", 0 -> "0 min". Never exposes raw "minutes" ledger language.
 */
export function formatDuration(minutes) {
  const total = Math.max(0, Math.round(Number(minutes) || 0));
  if (total === 0) return "0 min";
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} hr`;
  return `${h} hr ${m} min`;
}
