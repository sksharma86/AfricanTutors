import "server-only";

import Stripe from "stripe";

import { STRIPE_SECRET_KEY } from "./config";

let cached: Stripe | null = null;

/**
 * Lazily-initialized server-side Stripe client. Never import this from a Client
 * Component. Throws if Stripe is not configured so callers fail loudly rather
 * than silently proceeding without a real payment integration.
 */
export function getStripe(): Stripe {
  if (!STRIPE_SECRET_KEY) {
    throw new Error("Stripe is not configured (STRIPE_SECRET_KEY missing).");
  }
  if (!cached) {
    cached = new Stripe(STRIPE_SECRET_KEY, { typescript: true });
  }
  return cached;
}
