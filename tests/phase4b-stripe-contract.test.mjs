import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  STRIPE_CHECKOUT_MAX_SECONDS,
  STRIPE_CHECKOUT_MIN_SECONDS,
  stripeCheckoutExpiresAt,
} from "../src/lib/stripe/checkout-expiry.mjs";

// Guards the exact API-contract bug that a missing Stripe key hid before: a
// Checkout Session expires_at below Stripe's 30-minute minimum. Runs with no DB
// and no Stripe credentials.
describe("Stripe Checkout expiration contract", () => {
  it("Stripe minimum is 30 minutes, maximum is 24 hours", () => {
    assert.equal(STRIPE_CHECKOUT_MIN_SECONDS, 1800);
    assert.equal(STRIPE_CHECKOUT_MAX_SECONDS, 86400);
  });

  it("expires_at sent to Stripe is always within [30 min, 24 h] from now", () => {
    for (const now of [Date.now(), 0, 1_000_000_000_000, 1_900_000_000_000]) {
      const exp = stripeCheckoutExpiresAt(now);
      const delta = exp - Math.floor(now / 1000);
      assert.ok(delta >= STRIPE_CHECKOUT_MIN_SECONDS, `expires_at must be >= 30 min, got ${delta}s`);
      assert.ok(delta <= STRIPE_CHECKOUT_MAX_SECONDS, `expires_at must be <= 24 h, got ${delta}s`);
    }
  });

  it("the Stripe session lifetime is deliberately longer than the 15-min internal hold", () => {
    const internalHoldSeconds = 15 * 60;
    const delta = stripeCheckoutExpiresAt(Date.now()) - Math.floor(Date.now() / 1000);
    assert.ok(delta > internalHoldSeconds, "Stripe session must outlive the internal hold so late-payment handling can trigger");
  });
});
