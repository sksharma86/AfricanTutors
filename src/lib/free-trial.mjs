/**
 * Account-scoped free-trial eligibility (pure, unit-testable).
 *
 * The free 30-minute trial is ONE PER CUSTOMER ACCOUNT (not per student). Given
 * the account's own bookings (RLS already scopes them to the account), the trial
 * is "used" once ANY non-cancelled free-trial booking exists — so adding a new
 * student never restores eligibility. The server (account_has_used_free_trial +
 * the account-scoped unique index) remains authoritative.
 *
 * @param {{ is_free_trial?: boolean, status?: string }[]} bookings
 * @returns {boolean}
 */
export function accountFreeTrialUsed(bookings) {
  return (bookings || []).some((b) => b && b.is_free_trial && b.status !== "cancelled");
}
