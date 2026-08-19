export const STRIPE_CHECKOUT_MIN_SECONDS: number;
export const STRIPE_CHECKOUT_MAX_SECONDS: number;
export const STRIPE_CHECKOUT_LIFETIME_SECONDS: number;
export function stripeCheckoutExpiresAt(nowMs?: number): number;
