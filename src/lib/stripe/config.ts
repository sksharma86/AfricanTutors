/**
 * Stripe configuration read from the environment. Nothing here throws at import
 * time so the app builds/runs without Stripe configured (foundation phase).
 * Secret values are never exposed to the client — only `NEXT_PUBLIC_*` is.
 */
export const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
export const STRIPE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

/** Server can create Stripe API calls. */
export const isStripeConfigured = Boolean(STRIPE_SECRET_KEY);

/** Webhook endpoint can verify signatures. */
export const isStripeWebhookConfigured = Boolean(STRIPE_SECRET_KEY && STRIPE_WEBHOOK_SECRET);
