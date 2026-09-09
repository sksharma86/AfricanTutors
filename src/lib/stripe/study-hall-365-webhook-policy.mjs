/**
 * Authoritative rules for Study Hall 365 webhook snapshots.
 *
 * Mirrors upsert_study_hall_365_subscription event-created ordering
 * (`p_event_created < last_stripe_event_created` → skipped_stale) and the
 * Checkout payment correlation captured at subscription Checkout
 * (`subscription_data.metadata.payment_id` + account + Stripe customer).
 *
 * Retrieve-on-stale: production still retrieves the live Stripe subscription,
 * then stamps the *incoming event's* created timestamp. A live retrieve of
 * the current snapshot must not fulfill when the event itself is stale.
 */

import { STUDY_HALL_365_KIND } from "../study-hall-365/catalog.mjs";
import { shouldFulfillStudyHall365PaymentForStatus } from "./webhook-dispatch.mjs";

/**
 * Same comparison as 0044: strictly older created timestamps are stale.
 * Equal created is a retry of the same generation and must re-apply.
 *
 * @param {number|null|undefined} incomingCreated
 * @param {number|null|undefined} lastCreated
 */
export function isStaleStripeEvent(incomingCreated, lastCreated) {
  return Number(incomingCreated ?? 0) < Number(lastCreated ?? 0);
}

/**
 * Checkout stamps the same payment_id on the session and the subscription.
 * Explicit session payment_id must match subscription metadata when both are
 * present. We never fall back to "latest pending 365 payment".
 *
 * @param {{ subscriptionPaymentId?: string|null, explicitPaymentId?: string|null }} ids
 * @returns {string|null}
 */
export function correlatedStudyHall365PaymentId(ids) {
  const fromSub =
    typeof ids.subscriptionPaymentId === "string" && ids.subscriptionPaymentId
      ? ids.subscriptionPaymentId
      : null;
  const explicit =
    typeof ids.explicitPaymentId === "string" && ids.explicitPaymentId ? ids.explicitPaymentId : null;
  if (explicit && fromSub && explicit !== fromSub) return null;
  return explicit || fromSub;
}

/**
 * @param {object|null|undefined} payment
 * @param {{
 *   accountId?: string|null,
 *   customerId?: string|null,
 *   paymentId: string,
 *   checkoutSessionId?: string|null,
 * }} ctx
 */
export function paymentMatchesStudyHall365Checkout(payment, ctx) {
  if (!payment || payment.id !== ctx.paymentId) return false;
  if (payment.purpose !== "subscription") return false;
  if (!payment.account_id) return false;
  if (ctx.accountId && payment.account_id !== ctx.accountId) return false;
  if (ctx.customerId && payment.stripe_customer_id && payment.stripe_customer_id !== ctx.customerId) {
    return false;
  }
  if (
    ctx.checkoutSessionId &&
    payment.stripe_checkout_session_id &&
    payment.stripe_checkout_session_id !== ctx.checkoutSessionId
  ) {
    return false;
  }
  return true;
}

/**
 * Payment fulfillment is a side-effect of an *applied* entitled snapshot.
 * skipped_stale / ignored must not fulfill from a live retrieve that SQL rejected.
 *
 * @param {{
 *   applyStatus?: string|null,
 *   subscriptionStatus?: string|null,
 *   payment?: object|null,
 *   accountId?: string|null,
 *   customerId?: string|null,
 *   paymentId?: string|null,
 *   checkoutSessionId?: string|null,
 * }} input
 */
export function shouldFulfillStudyHall365CheckoutPayment(input) {
  if (input.applyStatus === "skipped_stale" || input.applyStatus === "ignored") return false;
  if (!shouldFulfillStudyHall365PaymentForStatus(input.subscriptionStatus)) return false;
  if (!input.paymentId) return false;
  return paymentMatchesStudyHall365Checkout(input.payment, {
    accountId: input.accountId,
    customerId: input.customerId,
    paymentId: input.paymentId,
    checkoutSessionId: input.checkoutSessionId,
  });
}

/**
 * In-memory membership apply used by adversarial tests. Same skip rule as SQL.
 *
 * @param {object|null} row
 * @param {{
 *   eventId: string,
 *   eventCreated: number,
 *   status: string,
 *   cancelAtPeriodEnd?: boolean,
 *   ended?: boolean,
 *   accountId: string,
 *   customerId: string,
 *   subscriptionId: string,
 *   paymentId?: string|null,
 * }} incoming
 */
export function applyStudyHall365MembershipSnapshot(row, incoming) {
  if (row && isStaleStripeEvent(incoming.eventCreated, row.lastStripeEventCreated)) {
    return {
      status: "skipped_stale",
      row,
      previous: row,
      current: row,
    };
  }
  const status = incoming.ended ? "canceled" : incoming.status;
  const next = {
    accountId: incoming.accountId,
    customerId: incoming.customerId,
    subscriptionId: incoming.subscriptionId,
    status,
    cancelAtPeriodEnd: Boolean(incoming.cancelAtPeriodEnd),
    ended: Boolean(incoming.ended),
    lastStripeEventId: incoming.eventId,
    lastStripeEventCreated: incoming.eventCreated,
    checkoutPaymentId: incoming.paymentId ?? row?.checkoutPaymentId ?? null,
  };
  return {
    status: row ? "updated" : "inserted",
    row: next,
    previous: row,
    current: next,
  };
}

/**
 * Production shape: retrieve current Stripe subscription, apply with the
 * *event's* created timestamp, then maybe fulfill.
 *
 * @param {{
 *   membership: object|null,
 *   event: { id: string, created: number, type?: string },
 *   retrievedSubscription: {
 *     id: string,
 *     status: string,
 *     customer: string,
 *     cancel_at_period_end?: boolean,
 *     metadata?: { payment_id?: string, account_id?: string },
 *   },
 *   payment?: object|null,
 *   explicitPaymentId?: string|null,
 *   ended?: boolean,
 * }} input
 */
export function reconcileStudyHall365WebhookSnapshot(input) {
  const sub = input.retrievedSubscription;
  const accountId = sub.metadata?.account_id ?? input.membership?.accountId ?? null;
  const apply = applyStudyHall365MembershipSnapshot(input.membership, {
    eventId: input.event.id,
    eventCreated: input.event.created,
    status: sub.status,
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    ended: Boolean(input.ended),
    accountId,
    customerId: sub.customer,
    subscriptionId: sub.id,
    paymentId: input.explicitPaymentId ?? sub.metadata?.payment_id ?? null,
  });
  const paymentId = correlatedStudyHall365PaymentId({
    subscriptionPaymentId: sub.metadata?.payment_id,
    explicitPaymentId: input.explicitPaymentId,
  });
  const fulfill = shouldFulfillStudyHall365CheckoutPayment({
    applyStatus: apply.status,
    subscriptionStatus: sub.status,
    payment: input.payment ?? null,
    accountId,
    customerId: sub.customer,
    paymentId,
  });
  return { apply, fulfill, paymentId };
}

export { STUDY_HALL_365_KIND, shouldFulfillStudyHall365PaymentForStatus };
