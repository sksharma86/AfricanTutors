/**
 * Customer-facing pricing for Study Hall (at home).
 *
 * IMPORTANT: This module holds ONLY customer-facing pricing. Never place Guide
 * compensation or internal unit economics here (or anywhere shipped to the
 * browser). Those live in the internal `BUSINESS_MODEL.md` document.
 *
 * Study Hall pricing model ($12/hour, whole-hour blocks only):
 *   - 1 hour  (60 min)  = $12
 *   - 2 hours (120 min) = $24
 *   - 3 hours (180 min) = $36
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

/** Customer-facing Study Hall session lengths (whole hours only). */
export const SESSION_OPTIONS: SessionOption[] = [
  { minutes: 60, priceUsd: 12, label: "1 hour" },
  { minutes: 120, priceUsd: 24, label: "2 hours" },
  { minutes: 180, priceUsd: 36, label: "3 hours" },
];

export type StudyHallDuration = 60 | 120 | 180;

export const STUDY_HALL_DURATIONS: StudyHallDuration[] = [60, 120, 180];

export function isStudyHallDuration(n: unknown): n is StudyHallDuration {
  return n === 60 || n === 120 || n === 180;
}

/** Primary retail pay-as-you-go rate (per hour). */
export const PAYG_MINUTES = 60;
export const PAYG_PRICE_USD = 12;

/** Lowest prepaid effective hourly rate (28 Hour Routine). Marketing only. */
export const PREPAID_FROM_HOURLY_USD = 9;

/** Length of the free introductory Study Hall session (one per account). */
export const FREE_TRIAL_MINUTES = 60;

/** Primary acquisition call-to-action label (kept consistent site-wide). */
export const FREE_TRIAL_CTA = "Try your first Study Hall free";

/** Retail pay-as-you-go cue for marketing heroes. */
export const STARTING_AT_LABEL = `Starting at $${PAYG_PRICE_USD}/hour`;

/** Friction-reducing microcopy. Use sparingly — do not repeat site-wide. */
export const NO_CARD_REQUIRED = "No credit card required.";

/** Accurate marketing price framing — prepaid floor, not PAYG. */
export const PLANS_FROM_LABEL = `Plans from $${PREPAID_FROM_HOURLY_USD}/hour`;
export const AS_LOW_AS_LABEL = `As low as $${PREPAID_FROM_HOURLY_USD}/hour`;

export function formatUsd(amount: number): string {
  return `$${amount}`;
}

/** Format integer cents as a USD string (e.g. 1300 -> "$13.00", 2000 -> "$20"). */
export function formatCents(cents: number): string {
  const dollars = cents / 100;
  return Number.isInteger(dollars) ? `$${dollars}` : `$${dollars.toFixed(2)}`;
}
