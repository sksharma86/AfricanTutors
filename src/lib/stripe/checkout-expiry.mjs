/**
 * Stripe-hosted Checkout Session lifetime — DELIBERATELY separate from the
 * African Tutors internal payment/booking hold.
 *
 * The African Tutors booking/payment hold is 15 minutes and is authoritative in
 * the database (see PAYMENT_HOLD_MINUTES / payments.expires_at). Stripe, however,
 * requires a Checkout Session `expires_at` between 30 minutes and 24 hours after
 * creation, so the hosted session cannot be told to expire at 15 minutes.
 *
 * We therefore give the Stripe session the minimum supported lifetime (30 min).
 * The internal 15-minute expiry still fires first and is what actually releases
 * the slot / restores credit. If a customer pays via a still-open Stripe session
 * AFTER the internal expiry (the 15–30 minute window), the delayed-payment path
 * credits the paid amount to the customer's account balance — the booking/package
 * is never silently resurrected.
 *
 * This module is plain ESM (with a sibling .d.ts) so the exact value sent to
 * Stripe can be unit-tested without a database or Stripe credentials.
 */

/** Stripe's minimum Checkout Session lifetime. */
export const STRIPE_CHECKOUT_MIN_SECONDS = 30 * 60;
/** Stripe's maximum Checkout Session lifetime. */
export const STRIPE_CHECKOUT_MAX_SECONDS = 24 * 60 * 60;
/** The lifetime we request (clamped into Stripe's supported window). */
export const STRIPE_CHECKOUT_LIFETIME_SECONDS = 30 * 60;

/**
 * Absolute unix-seconds timestamp for a Checkout Session `expires_at`, guaranteed
 * to sit within Stripe's supported [30 min, 24 h] window.
 * @param {number} [nowMs]
 * @returns {number}
 */
export function stripeCheckoutExpiresAt(nowMs = Date.now()) {
  const lifetime = Math.min(
    Math.max(STRIPE_CHECKOUT_LIFETIME_SECONDS, STRIPE_CHECKOUT_MIN_SECONDS),
    STRIPE_CHECKOUT_MAX_SECONDS,
  );
  return Math.floor(nowMs / 1000) + lifetime;
}
