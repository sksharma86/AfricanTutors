/**
 * Customer no-show presentation helpers.
 * Server/database time in guide_mark_customer_no_show is authoritative.
 * This module is display-only and must not be trusted for eligibility.
 */

export const CUSTOMER_NO_SHOW_WAIT_MIN = 15;
export const CALL_PARENT_PROMPT_MIN = 3;

/**
 * @param {string | null | undefined} startISO
 * @returns {string | null}
 */
export function customerNoShowEligibleAt(startISO) {
  if (!startISO) return null;
  const start = Date.parse(startISO);
  if (!Number.isFinite(start)) return null;
  return new Date(start + CUSTOMER_NO_SHOW_WAIT_MIN * 60000).toISOString();
}

/**
 * Display state for the Guide wait / Call Parent / mark-no-show flow.
 * @param {{
 *   status?: string | null,
 *   scheduledStart?: string | null,
 *   studentJoinedAt?: string | null,
 *   paymentStatus?: string | null,
 *   nowMs?: number,
 * }} input
 */
export function customerNoShowUiState({
  status = null,
  scheduledStart = null,
  studentJoinedAt = null,
  paymentStatus = null,
  nowMs = Date.now(),
} = {}) {
  if (status === "no_show") {
    return { kind: "recorded", remainingMin: 0, eligibleAtISO: null, callParentPrompt: false };
  }
  if (paymentStatus === "awaiting_payment") {
    return { kind: "awaiting_payment", remainingMin: 0, eligibleAtISO: null, callParentPrompt: false };
  }
  if (status === "cancelled" || status === "expired") {
    return { kind: "cancelled", remainingMin: 0, eligibleAtISO: null, callParentPrompt: false };
  }
  if (status === "completed") {
    return { kind: "completed", remainingMin: 0, eligibleAtISO: null, callParentPrompt: false };
  }
  if (status !== "confirmed") {
    return { kind: "ineligible", remainingMin: 0, eligibleAtISO: null, callParentPrompt: false };
  }
  if (studentJoinedAt) {
    return { kind: "child_joined", remainingMin: 0, eligibleAtISO: null, callParentPrompt: false };
  }
  const eligibleAtISO = customerNoShowEligibleAt(scheduledStart);
  if (!scheduledStart || !eligibleAtISO) {
    return { kind: "ineligible", remainingMin: 0, eligibleAtISO: null, callParentPrompt: false };
  }
  const start = Date.parse(scheduledStart);
  if (nowMs < start) {
    return { kind: "not_started", remainingMin: CUSTOMER_NO_SHOW_WAIT_MIN, eligibleAtISO, callParentPrompt: false };
  }
  const remainingMs = Date.parse(eligibleAtISO) - nowMs;
  const remainingMin = Math.max(0, Math.ceil(remainingMs / 60000));
  const callParentPrompt = nowMs >= start + CALL_PARENT_PROMPT_MIN * 60000;
  if (nowMs < Date.parse(eligibleAtISO)) {
    return { kind: "waiting", remainingMin, eligibleAtISO, callParentPrompt };
  }
  return { kind: "eligible", remainingMin: 0, eligibleAtISO, callParentPrompt: true };
}

export function customerNoShowGuideCopy(kind) {
  if (kind === "waiting") {
    return "Stay present. Wait for the child. Do not mark a customer no-show yet.";
  }
  if (kind === "eligible") {
    return "The child has not joined. You can mark this as a customer no-show. You still receive full pay.";
  }
  if (kind === "recorded") {
    return "Customer no-show recorded. No session report is required.";
  }
  if (kind === "child_joined") {
    return "The child joined. Continue Plan → Focus → Finish.";
  }
  return null;
}
