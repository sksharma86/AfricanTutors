/**
 * Extract billing-period fields from the Stripe SDK objects used in this repo
 * (stripe ^22). current_period_start / current_period_end live on
 * SubscriptionItem, not on Subscription itself.
 */

/**
 * @param {unknown} value
 * @returns {string|null}
 */
export function stripeId(value) {
  if (typeof value === "string" && value) return value;
  if (value && typeof value === "object" && typeof value.id === "string") return value.id;
  return null;
}

/**
 * @param {number|null|undefined} seconds
 * @returns {Date|null}
 */
export function fromUnixSeconds(seconds) {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds <= 0) return null;
  return new Date(seconds * 1000);
}

/**
 * @param {object|null|undefined} subscription
 * @returns {{ start: Date, end: Date, priceId: string|null } | null}
 */
export function subscriptionPaidPeriod(subscription) {
  if (!subscription || typeof subscription !== "object") return null;
  const item = Array.isArray(subscription.items?.data) ? subscription.items.data[0] : null;
  const startSec = item?.current_period_start ?? subscription.current_period_start;
  const endSec = item?.current_period_end ?? subscription.current_period_end;
  const start = fromUnixSeconds(startSec);
  const end = fromUnixSeconds(endSec);
  if (!start || !end || end <= start) return null;
  const price = item?.price;
  const priceId = stripeId(price);
  return { start, end, priceId };
}

/**
 * @param {object|null|undefined} invoice
 * @returns {string|null}
 */
export function invoiceSubscriptionId(invoice) {
  if (!invoice || typeof invoice !== "object") return null;
  return (
    stripeId(invoice.subscription) ||
    stripeId(invoice.parent?.subscription_details?.subscription) ||
    stripeId(invoice.parent?.subscription_details) ||
    null
  );
}
