/**
 * Customer-facing pricing for African Tutors.
 *
 * IMPORTANT: This module holds ONLY customer-facing pricing. Never place tutor
 * compensation or internal unit economics here (or anywhere shipped to the
 * browser). Those live in the internal `BUSINESS_MODEL.md` document.
 *
 * Finalized model (Prompt 2.7):
 *   - 30-minute session: $12
 *   - 60-minute session: $20
 *   - A new student's first 30-minute session is FREE (no card required).
 */

export interface SessionOption {
  minutes: number;
  priceUsd: number;
  label: string;
}

export const SESSION_OPTIONS: SessionOption[] = [
  { minutes: 30, priceUsd: 12, label: "30 minutes" },
  { minutes: 60, priceUsd: 20, label: "60 minutes" },
];

/** Length of the free introductory session a new student can claim. */
export const FREE_TRIAL_MINUTES = 30;

/** Primary acquisition call-to-action label. */
export const FREE_TRIAL_CTA = "Try 30 Minutes Free";

/** Friction-reducing microcopy. Use sparingly — do not repeat site-wide. */
export const NO_CARD_REQUIRED = "No credit card required.";

export function formatUsd(amount: number): string {
  return `$${amount}`;
}
