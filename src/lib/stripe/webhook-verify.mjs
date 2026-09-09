/**
 * Stripe webhook signature verification. Uses the Stripe SDK static helper so
 * verification does not require a configured STRIPE_SECRET_KEY.
 *
 * The HTTP route still fail-closes when STRIPE_WEBHOOK_SECRET is missing.
 * Event payloads are untrusted until this helper succeeds.
 */

import Stripe from "stripe";

/**
 * @param {string} rawBody
 * @param {string|null|undefined} signature
 * @param {string|null|undefined} secret
 * @returns {import("stripe").Stripe.Event}
 */
export function verifyStripeWebhookEvent(rawBody, signature, secret) {
  if (!secret) {
    const err = new Error("missing_webhook_secret");
    err.code = "missing_webhook_secret";
    throw err;
  }
  if (!signature) {
    const err = new Error("missing_signature");
    err.code = "missing_signature";
    throw err;
  }
  return Stripe.webhooks.constructEvent(rawBody, signature, secret);
}
