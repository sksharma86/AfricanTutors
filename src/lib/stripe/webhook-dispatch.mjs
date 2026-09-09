/**
 * Authoritative Stripe webhook dispatch *after* signature verification.
 *
 * begin_stripe_event claims the event id before any business mutation.
 * Duplicate completed events are 200 no-ops. In-progress claims are 409 so
 * Stripe retries. Failures mark the event failed and return 500 so Stripe retries.
 */

import { STUDY_HALL_365_KIND } from "../study-hall-365/catalog.mjs";

export const HANDLED_STRIPE_EVENT_TYPES = Object.freeze([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "checkout.session.expired",
  "payment_intent.succeeded",
  "payment_intent.payment_failed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
]);

/**
 * @param {import("stripe").Stripe.Checkout.Session} session
 * @returns {boolean}
 */
export function isPaidCheckoutSession(session) {
  return session?.payment_status === "paid" || session?.payment_status === "no_payment_required";
}

/**
 * Study Hall 365 Checkout is paid at first invoice collection. Unpaid completed
 * sessions wait for invoice.paid / async_payment_succeeded — they must not
 * mint membership from the redirect.
 *
 * @param {import("stripe").Stripe.Checkout.Session} session
 * @returns {boolean}
 */
export function shouldFulfillStudyHall365CheckoutSession(session) {
  return isPaidCheckoutSession(session);
}

/**
 * First-invoice 365 payment row is fulfilled only for a live entitled
 * subscription. past_due / unpaid / incomplete must not mark Checkout paid.
 *
 * @param {string|null|undefined} status
 * @returns {boolean}
 */
export function shouldFulfillStudyHall365PaymentForStatus(status) {
  return status === "active" || status === "trialing";
}

/**
 * @param {import("stripe").Stripe.Metadata | null | undefined} metadata
 * @returns {"booking"|"package"|"study_hall_365"|null}
 */
export function stripeCheckoutKind(metadata) {
  const kind = metadata?.kind;
  if (kind === "booking" || kind === "package" || kind === STUDY_HALL_365_KIND) return kind;
  return null;
}

/**
 * @typedef {object} StripeWebhookDeps
 * @property {(id: string, type: string) => Promise<string>} beginStripeEvent
 * @property {(id: string) => Promise<void>} completeStripeEvent
 * @property {(id: string, error?: string) => Promise<void>} failStripeEvent
 * @property {(metadata: unknown, amount: number|null|undefined, paymentIntent: unknown) => Promise<void>} fulfillFromMetadata
 * @property {(session: import("stripe").Stripe.Checkout.Session, event: import("stripe").Stripe.Event) => Promise<void>} fulfillStudyHall365Checkout
 * @property {(session: import("stripe").Stripe.Checkout.Session) => boolean} isStudyHall365Session
 * @property {(params: { subscriptionId: string, accountId?: string|null, eventId: string, eventCreated: number, ended?: boolean }) => Promise<unknown>} syncSubscriptionById
 * @property {(invoice: import("stripe").Stripe.Invoice, event: import("stripe").Stripe.Event) => Promise<unknown>} syncFromInvoice
 * @property {(metadata: unknown, reason: string) => Promise<void>} cancelFromMetadata
 */

/**
 * @param {import("stripe").Stripe.Event} event
 * @param {StripeWebhookDeps} deps
 */
async function dispatchStripeEvent(event, deps) {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      if (deps.isStudyHall365Session(session)) {
        if (shouldFulfillStudyHall365CheckoutSession(session)) {
          await deps.fulfillStudyHall365Checkout(session, event);
        }
        break;
      }
      if (session.payment_status === "paid") {
        await deps.fulfillFromMetadata(session.metadata, session.amount_total, session.payment_intent);
      }
      break;
    }
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object;
      if (deps.isStudyHall365Session(session)) {
        await deps.fulfillStudyHall365Checkout(session, event);
        break;
      }
      await deps.fulfillFromMetadata(session.metadata, session.amount_total, session.payment_intent);
      break;
    }
    case "payment_intent.succeeded": {
      const pi = event.data.object;
      await deps.fulfillFromMetadata(pi.metadata, pi.amount_received ?? pi.amount, pi.id);
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = event.data.object;
      await deps.syncSubscriptionById({
        subscriptionId: sub.id,
        accountId: sub.metadata?.account_id ?? null,
        eventId: event.id,
        eventCreated: event.created,
      });
      break;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object;
      await deps.syncSubscriptionById({
        subscriptionId: sub.id,
        accountId: sub.metadata?.account_id ?? null,
        eventId: event.id,
        eventCreated: event.created,
        ended: true,
      });
      break;
    }
    case "invoice.paid": {
      const invoice = event.data.object;
      await deps.syncFromInvoice(invoice, event);
      break;
    }
    case "invoice.payment_failed": {
      const invoice = event.data.object;
      await deps.syncFromInvoice(invoice, event);
      break;
    }
    case "checkout.session.expired":
    case "checkout.session.async_payment_failed": {
      const session = event.data.object;
      await deps.cancelFromMetadata(session.metadata, "Stripe checkout expired/failed");
      break;
    }
    case "payment_intent.payment_failed": {
      const pi = event.data.object;
      await deps.cancelFromMetadata(pi.metadata, "Stripe payment failed");
      break;
    }
    default:
      break;
  }
}

/**
 * @param {import("stripe").Stripe.Event} event
 * @param {StripeWebhookDeps} deps
 * @returns {Promise<{ status: number, body: Record<string, unknown> }>}
 */
export async function processVerifiedStripeEvent(event, deps) {
  let claim;
  try {
    claim = await deps.beginStripeEvent(event.id, event.type);
  } catch {
    return { status: 500, body: { error: "Event processing failed." } };
  }
  if (claim === "duplicate") {
    return { status: 200, body: { received: true, duplicate: true } };
  }
  if (claim === "in_progress") {
    return { status: 409, body: { received: false, inProgress: true } };
  }

  try {
    await dispatchStripeEvent(event, deps);
  } catch {
    await deps.failStripeEvent(event.id, "fulfillment_error");
    return { status: 500, body: { error: "Fulfillment failed." } };
  }

  await deps.completeStripeEvent(event.id);
  return { status: 200, body: { received: true } };
}
