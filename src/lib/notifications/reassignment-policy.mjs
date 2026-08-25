/**
 * Guide reassignment notification recipient policy (PR8 amendment).
 *
 * Parents book a date/time, not a particular Guide. Successful internal
 * Guide replacement (session time unchanged) is invisible to parents.
 */

/**
 * @typedef {"successful_internal" | "session_impacted"} ReassignmentOutcome
 */

/**
 * @param {boolean} reassigned
 *   true  = Guide successfully replaced (session continues as booked)
 *   false = release / replacement failed (session cancelled or value restored)
 * @returns {ReassignmentOutcome}
 */
export function reassignmentOutcome(reassigned) {
  return reassigned ? "successful_internal" : "session_impacted";
}

/**
 * Who receives outbound notifications for a reassignment outcome.
 * Manager visibility for successful_internal is audit/log only (no routine alert).
 *
 * @param {ReassignmentOutcome} outcome
 */
export function reassignmentRecipients(outcome) {
  if (outcome === "successful_internal") {
    return Object.freeze({
      parentEmail: false,
      parentSms: false,
      newGuideAssignment: true,
      removedGuide: true,
      managerExceptionAlert: false,
    });
  }
  // Session impacted (release / failed replacement / cancelled for customer).
  return Object.freeze({
    parentEmail: true,
    parentSms: false, // email covers material impact; cancel path owns cancel SMS
    newGuideAssignment: false,
    removedGuide: false,
    managerExceptionAlert: true,
  });
}

/** True when parent must not be told about a successful Guide swap. */
export function parentSilentOnSuccessfulReassignment(reassigned) {
  return reassignmentRecipients(reassignmentOutcome(reassigned)).parentEmail === false
    && reassignmentRecipients(reassignmentOutcome(reassigned)).parentSms === false;
}
