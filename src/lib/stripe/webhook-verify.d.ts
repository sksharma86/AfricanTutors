import type Stripe from "stripe";

export function verifyStripeWebhookEvent(
  rawBody: string,
  signature: string | null | undefined,
  secret: string | null | undefined,
): Stripe.Event;
