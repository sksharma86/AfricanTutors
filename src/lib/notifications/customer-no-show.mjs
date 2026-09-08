/**
 * PR7D — customer no-show notification helpers.
 *
 * PR6 (migration 0043 + `guide_mark_customer_no_show`) remains the
 * authoritative no-show system. PR7D only attaches parent + Guide
 * emails after that RPC has already committed `status = no_show`.
 *
 * Dedupe keys are durable per booking + recipient. They never include
 * Date.now() or a request timestamp. `claim_email_delivery` makes
 * first-transition and already-no_show retries both safe: the first
 * successful send wins, later invocations claim-skip.
 *
 * Parent SMS is catalogued in PR7A but deferred to PR7F (no consent /
 * opt-out infrastructure exists). Guide SMS / WhatsApp and routine
 * Management notifications are not part of PR7D.
 */

export const CUSTOMER_NO_SHOW_PARENT_EVENT = "customer_no_show_parent";
export const CUSTOMER_NO_SHOW_GUIDE_EVENT = "customer_no_show_guide";

export const CUSTOMER_NO_SHOW_PARENT_DEDUPE_PREFIX = "customer-no-show-parent:";
export const CUSTOMER_NO_SHOW_GUIDE_DEDUPE_PREFIX = "customer-no-show-guide:";

export function customerNoShowParentDedupeKey(bookingId) {
  return `${CUSTOMER_NO_SHOW_PARENT_DEDUPE_PREFIX}${bookingId}`;
}

export function customerNoShowGuideDedupeKey(bookingId) {
  return `${CUSTOMER_NO_SHOW_GUIDE_DEDUPE_PREFIX}${bookingId}`;
}

/** Parent Study Halls surface. Application route, not a provider URL. */
export const CUSTOMER_NO_SHOW_PARENT_CTA_PATH = "/dashboard/student/study-halls";

/** Guide Study Halls / workstation surface. */
export const CUSTOMER_NO_SHOW_GUIDE_CTA_PATH = "/dashboard/tutor/study-halls";

/**
 * True when the PR6 RPC result is an authoritative customer no-show.
 * Fires for both first transition (`idempotent: false`) and already-no_show
 * retries (`idempotent: true`). Delivery uniqueness is owned by
 * `claim_email_delivery`, not by this gate.
 *
 * False for rejected / failed RPC payloads (`too_early`, `student_present`,
 * `unauthorized`, `not_confirmed`, missing status, thrown errors).
 */
export function shouldNotifyCustomerNoShow(rpcResult) {
  if (!rpcResult || typeof rpcResult !== "object") return false;
  const status = rpcResult.status ?? rpcResult.booking_status;
  return status === "no_show";
}

/**
 * Guide API gate: notify only after supabase-js `{ data, error }` shows the
 * RPC succeeded as a customer no-show. Errors (T+15, presence, unauthorized,
 * non-confirmed) never notify. A click alone is never enough.
 */
export function shouldNotifyCustomerNoShowAfterRpc(rpc) {
  if (!rpc || typeof rpc !== "object") return false;
  if (rpc.error) return false;
  return shouldNotifyCustomerNoShow(rpc.data ?? rpc);
}
