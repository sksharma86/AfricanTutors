/**
 * Maps internal state machine values into polished, customer-facing language.
 * Major customer screens must NEVER print raw snake_case enums. Tones drive the
 * StatusBadge color; keep them in a small fixed vocabulary.
 *
 * Tone vocabulary: "positive" | "neutral" | "warning" | "danger" | "info"
 */

/**
 * Customer-facing booking status. `paymentStatus` lets a confirmed-but-unpaid
 * booking read as "Awaiting payment" instead of "Confirmed".
 * @param {string} status
 * @param {string} [paymentStatus]
 * @returns {{ label: string, tone: string }}
 */
export function customerBookingStatus(status, paymentStatus) {
  if ((status === "pending" || status === "confirmed") && paymentStatus === "awaiting_payment") {
    return { label: "Awaiting payment", tone: "warning" };
  }
  switch (status) {
    case "confirmed":
      return { label: "Confirmed", tone: "positive" };
    case "pending":
      return { label: "Awaiting confirmation", tone: "warning" };
    case "completed":
      return { label: "Completed", tone: "neutral" };
    case "cancelled":
      return { label: "Cancelled", tone: "neutral" };
    case "no_show":
      return { label: "Missed session", tone: "danger" };
    case "expired":
      return { label: "Booking expired", tone: "neutral" };
    default:
      return { label: "Scheduled", tone: "info" };
  }
}

/**
 * Customer-facing "report an issue" status. Never expose admin arbitration
 * terms like "denied" — collapse to a neutral resolved/closed reading.
 * @param {string} status
 * @returns {{ label: string, tone: string }}
 */
export function issueStatus(status) {
  switch (status) {
    case "open":
      return { label: "Received", tone: "info" };
    case "under_review":
      return { label: "Under review", tone: "warning" };
    case "resolved":
      return { label: "Resolved", tone: "positive" };
    case "denied":
      return { label: "Reviewed", tone: "neutral" };
    default:
      return { label: "Received", tone: "info" };
  }
}
