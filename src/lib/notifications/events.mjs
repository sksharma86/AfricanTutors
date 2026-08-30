/**
 * Canonical Study Hall notification event types (PR8).
 * Used for documentation, tests, and future audit tagging.
 */

export const NOTIFICATION_EVENTS = Object.freeze({
  BOOKING_CONFIRMED: "booking_confirmed",
  BOOKING_CANCELLED: "booking_cancelled",
  /** Successful internal Guide swap — Guides only; parent silent. */
  GUIDE_REASSIGNED: "guide_reassigned",
  /** Replacement failed / booking released — parent + manager. */
  GUIDE_REASSIGNMENT_FAILED: "guide_reassignment_failed",
  SESSION_REMINDER_1H: "session_reminder_1h",
  PACKAGE_PURCHASED: "package_purchased",
  PACKAGE_BALANCE_LOW: "package_balance_low",
  PACKAGE_BALANCE_DEPLETED: "package_balance_depleted",
  ACCOUNT_CREDIT_APPLIED: "account_credit_applied",
  WELCOME: "welcome",
  SESSION_REPORT_READY: "session_report_ready",
  GUIDE_ASSIGNMENT: "guide_assignment",
  GUIDE_SESSION_REMINDER: "guide_session_reminder",
  GUIDE_REPORT_REQUIRED: "guide_report_required",
  GUIDE_REPORT_OVERDUE: "guide_report_overdue",
  CALL_PARENT_ESCALATION: "call_parent_escalation",
  CALL_PARENT_FAILURE: "call_parent_failure",
  PAYMENT_FAILURE: "payment_failure",
  RECORDING_FAILURE: "recording_failure",
  GUIDE_ATTENDANCE_REQUEST: "guide_attendance_request",
  GUIDE_CONFIRMATION_MISSED: "guide_confirmation_missed",
  COVERAGE_CANCELLATION: "coverage_cancellation",
  GUIDE_ATTENDANCE_WHATSAPP: "guide_attendance_whatsapp",
});

export const CHANNEL_POLICY = Object.freeze({
  email: [
    "booking_confirmed",
    "package_purchased",
    "package_balance_low",
    "package_balance_depleted",
    "account_credit_applied",
    "welcome",
    "session_report_ready",
    "booking_cancelled",
    // Parent email only for failed/impacted reassignment (release), not successful swap.
    "guide_reassignment_failed",
    "session_reminder_1h",
    "guide_assignment",
    "guide_session_reminder",
    "guide_report_required",
    "guide_report_overdue",
    "call_parent_failure",
    "payment_failure",
    "recording_failure",
    "guide_attendance_request",
    "guide_confirmation_missed",
    "coverage_cancellation",
  ],
  /**
   * Urgent Guide operational alerts. Not parent SMS. Not inbound confirmation.
   */
  whatsapp: [
    "guide_attendance_request",
    "guide_attendance_whatsapp",
  ],
  sms: [
    "session_reminder_1h",
    "call_parent_escalation",
    "booking_cancelled",
    "coverage_cancellation",
    // Successful Guide reassignment must NEVER SMS the parent.
  ],
  voice: ["call_parent_escalation"],
  /**
   * Successful internal Guide reassignment recipients (no parent channels).
   * Parent notification is reserved for session-impacted outcomes only.
   */
  guide_reassigned_success: Object.freeze({
    parent: [],
    newGuide: ["email"],
    removedGuide: ["email"],
    manager: [], // audit/log only; no routine alert
  }),
});
