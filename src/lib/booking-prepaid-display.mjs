/**
 * Pure display helpers for prepaid Study Hall booking UX.
 * Presentation only — never decides funding, ledgers, or Stripe.
 */

import { formatDuration } from "./format.mjs";

/**
 * True when prepaid inventory fully covers the selected duration
 * (mirrors the all-or-nothing book_session rule for UI only).
 *
 * @param {number | null | undefined} balanceMinutes
 * @param {number} durationMinutes
 */
export function prepaidCoversDuration(balanceMinutes, durationMinutes) {
  const bal = Math.max(0, Math.round(Number(balanceMinutes) || 0));
  const need = Math.max(0, Math.round(Number(durationMinutes) || 0));
  return need > 0 && bal >= need;
}

/**
 * Right-hand label on a duration selection card.
 * Prepaid path: "Uses 1 hr of your balance". Otherwise cash list price.
 *
 * @param {number | null | undefined} balanceMinutes
 * @param {number} durationMinutes
 * @param {string} cashPriceLabel e.g. "$12" from formatUsd
 */
export function durationOptionPriceLabel(balanceMinutes, durationMinutes, cashPriceLabel) {
  if (prepaidCoversDuration(balanceMinutes, durationMinutes)) {
    return `Uses ${formatDuration(durationMinutes)} of your balance`;
  }
  return cashPriceLabel;
}

/**
 * Confirm-step: fully prepaid when package minutes cover the session and $0 Stripe due.
 *
 * @param {{ package_minutes_used?: number, stripe_cents_due?: number } | null | undefined} quote
 */
export function isFullyPrepaidQuote(quote) {
  if (!quote) return false;
  return Number(quote.package_minutes_used) > 0 && Number(quote.stripe_cents_due) === 0;
}

/**
 * Display-only remaining balance after a prepaid deduction (not a ledger write).
 *
 * @param {number | null | undefined} balanceMinutes
 * @param {number | null | undefined} packageMinutesUsed
 */
export function remainingBalanceMinutes(balanceMinutes, packageMinutesUsed) {
  const bal = Math.max(0, Math.round(Number(balanceMinutes) || 0));
  const used = Math.max(0, Math.round(Number(packageMinutesUsed) || 0));
  return Math.max(0, bal - used);
}
