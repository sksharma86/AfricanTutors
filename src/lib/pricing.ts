/**
 * Customer-facing pricing for Study Hall at Home.
 *
 * IMPORTANT: This module holds ONLY customer-facing pricing. Never place Guide
 * compensation or internal unit economics here (or anywhere shipped to the
 * browser). Those live in the internal `BUSINESS_MODEL.md` document.
 *
 * Study Hall pricing model:
 *   - Pay as you go: 60-minute session = $12 ($12/hour)
 *   - 30-minute paid duration retained at $12 for internal/booking support
 *   - A new account's first 60-minute Study Hall session is FREE (no card)
 *
 * Server SQL (`session_list_price_cents` / booking_quote / book_session /
 * create_booking) is the financial authority — keep these numbers in sync.
 * Free-trial bookings must NEVER inherit the paid list price.
 */

export interface SessionOption {
  minutes: number;
  priceUsd: number;
  label: string;
}

export const SESSION_OPTIONS: SessionOption[] = [
  { minutes: 30, priceUsd: 12, label: "30 minutes" },
  { minutes: 60, priceUsd: 12, label: "60 minutes" },
];

/** Primary retail pay-as-you-go rate (60 minutes). */
export const PAYG_MINUTES = 60;
export const PAYG_PRICE_USD = 12;

/** Length of the free introductory Study Hall session (one per account). */
export const FREE_TRIAL_MINUTES = 60;

/** Primary acquisition call-to-action label (kept consistent site-wide). */
export const FREE_TRIAL_CTA = "Start free session";

/** Friction-reducing microcopy. Use sparingly — do not repeat site-wide. */
export const NO_CARD_REQUIRED = "No credit card required.";

export function formatUsd(amount: number): string {
  return `$${amount}`;
}

/** Format integer cents as a USD string (e.g. 1300 -> "$13.00", 2000 -> "$20"). */
export function formatCents(cents: number): string {
  const dollars = cents / 100;
  return Number.isInteger(dollars) ? `$${dollars}` : `$${dollars.toFixed(2)}`;
}
