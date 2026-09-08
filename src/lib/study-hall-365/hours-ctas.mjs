/**
 * Parent Hours Study Hall 365 CTAs.
 *
 * Join visibility must follow the same server gate as checkout:
 * `study_hall_365_has_open_membership`. Do not infer from customer_status,
 * periodEnd, cancel_at_period_end, or row existence alone.
 *
 * `openMembership` is true | false | null. null means the RPC failed or
 * returned an unexpected value — never treat that as "Join is safe".
 */

export const OPEN_MEMBERSHIP_ATTENTION_TITLE = "Your Study Hall 365 membership needs attention.";
export const OPEN_MEMBERSHIP_ATTENTION_BODY =
  "Manage your membership or billing to continue using Study Hall 365.";
export const OPEN_MEMBERSHIP_UNKNOWN_MESSAGE =
  "We couldn't confirm your Study Hall 365 membership status. Please try again in a moment.";

/**
 * @param {unknown} rpcResult
 * @returns {boolean | null}
 */
export function parseOpenMembershipFlag(rpcResult) {
  if (!rpcResult || typeof rpcResult !== "object") return null;
  if (rpcResult.error) return null;
  if (rpcResult.data === true) return true;
  if (rpcResult.data === false) return false;
  return null;
}

/**
 * Join is allowed only when the open-membership predicate is explicitly false.
 * @param {boolean | null | undefined} openMembership
 */
export function joinAllowedByOpenMembership(openMembership) {
  return openMembership === false;
}

/**
 * @param {{
 *   entitled?: boolean,
 *   openMembership?: boolean | null,
 *   hasMembership?: boolean,
 *   cancelAtPeriodEnd?: boolean,
 * }} [input]
 */
export function studyHall365HoursCtas(input = {}) {
  const entitled = Boolean(input.entitled);
  const hasMembership = Boolean(input.hasMembership);
  const cancelAtPeriodEnd = Boolean(input.cancelAtPeriodEnd);
  const open = input.openMembership;

  if (entitled) {
    return {
      kind: "entitled",
      showJoin: false,
      showManageBilling: true,
      showKeepMembership: cancelAtPeriodEnd,
      showCancelAtPeriodEnd: !cancelAtPeriodEnd,
      showAttentionCopy: false,
      attentionTitle: null,
      attentionBody: null,
      unknownStatus: false,
      unknownMessage: null,
    };
  }

  if (open === true) {
    return {
      kind: "open_not_entitled",
      showJoin: false,
      showManageBilling: true,
      showKeepMembership: false,
      showCancelAtPeriodEnd: false,
      showAttentionCopy: true,
      attentionTitle: OPEN_MEMBERSHIP_ATTENTION_TITLE,
      attentionBody: OPEN_MEMBERSHIP_ATTENTION_BODY,
      unknownStatus: false,
      unknownMessage: null,
    };
  }

  if (open === false) {
    return {
      kind: "not_open",
      showJoin: true,
      showManageBilling: hasMembership,
      showKeepMembership: false,
      showCancelAtPeriodEnd: false,
      showAttentionCopy: false,
      attentionTitle: null,
      attentionBody: null,
      unknownStatus: false,
      unknownMessage: null,
    };
  }

  return {
    kind: "unknown",
    showJoin: false,
    showManageBilling: hasMembership,
    showKeepMembership: false,
    showCancelAtPeriodEnd: false,
    showAttentionCopy: false,
    attentionTitle: null,
    attentionBody: null,
    unknownStatus: true,
    unknownMessage: OPEN_MEMBERSHIP_UNKNOWN_MESSAGE,
  };
}
