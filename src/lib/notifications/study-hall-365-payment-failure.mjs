/**
 * PR7C — Study Hall 365 payment-failure parent email.
 *
 * Do not send because Stripe emitted `invoice.payment_failed`.
 * Classify after `upsert_study_hall_365_subscription` has written the
 * authoritative membership snapshot for the invoice's subscription.
 *
 * Policy A: one parent email per Stripe invoice id, not per collection
 * attempt. Stripe retries the same open invoice; those retries must not spam.
 */

import { invoiceSubscriptionId, stripeId } from "../study-hall-365/stripe-period.mjs";
import { isoKeyPart, wasEstablishedMembership } from "./study-hall-365-lifecycle.mjs";

/** Stripe statuses that mean payment trouble, not membership-ended. */
export const STUDY_HALL_365_PAYMENT_PROBLEM_STATUSES = Object.freeze(["past_due", "unpaid"]);

/**
 * Durable claim key. Invoice id only — never Date.now(), webhook time,
 * or Stripe attempt_count.
 *
 * @param {unknown} invoiceId
 * @returns {string | null}
 */
export function studyHall365PaymentFailureKey(invoiceId) {
  const id = typeof invoiceId === "string" ? invoiceId.trim() : stripeId(invoiceId);
  if (!id) return null;
  return `365-payment-failure:${id}`;
}

/**
 * Invoice still needs collection (not paid / voided). Used so invoice.paid
 * recovery syncs cannot emit a failure email.
 *
 * @param {object | null | undefined} invoice
 */
export function invoiceIndicatesOpenBalance(invoice) {
  if (!invoice || typeof invoice !== "object") return false;
  if (invoice.paid === true) return false;
  const status = typeof invoice.status === "string" ? invoice.status : "";
  if (status === "paid" || status === "void") return false;
  const remaining = Number(invoice.amount_remaining ?? 0);
  if (Number.isFinite(remaining) && remaining > 0) return true;
  return status === "open" || status === "uncollectible";
}

function applyStatusBlocksNotify(applyStatus) {
  return (
    applyStatus === "skipped_stale" ||
    applyStatus === "ignored" ||
    applyStatus === "no_subscription"
  );
}

/**
 * Authoritative PR7C condition:
 *   - invoice belongs to a Stripe subscription (365 sync path)
 *   - invoice still has an open balance
 *   - upsert applied (not ignored / stale)
 *   - current membership is past_due or unpaid
 *   - membership has not ended (PR7B owns ended)
 *   - previous snapshot was an established membership (not incomplete checkout)
 *
 * @param {{
 *   applyStatus?: string | null,
 *   previous?: object | null,
 *   current?: object | null,
 *   invoice?: object | null,
 * }} [input]
 */
export function shouldNotifyStudyHall365PaymentFailure(input = {}) {
  if (applyStatusBlocksNotify(input.applyStatus)) return false;
  const invoice = input.invoice;
  if (!invoiceIndicatesOpenBalance(invoice)) return false;
  if (!invoiceSubscriptionId(invoice)) return false;
  if (!studyHall365PaymentFailureKey(invoice.id)) return false;

  const current = input.current;
  if (!current) return false;
  if (isoKeyPart(current.ended_at)) return false;
  const status = typeof current.status === "string" ? current.status : "";
  if (!STUDY_HALL_365_PAYMENT_PROBLEM_STATUSES.includes(status)) return false;
  if (!wasEstablishedMembership(input.previous)) return false;
  return true;
}
