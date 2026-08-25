/**
 * Canonical Study Hall notification event types (PR8).
 * Used for documentation, tests, and future audit tagging.
 */

export const NOTIFICATION_EVENTS = Object.freeze({
  BOOKING_CONFIRMED: "booking_confirmed",
  BOOKING_CANCELLED: "booking_cancelled",
  GUIDE_REASSIGNED: "guide_reassigned",
  SESSION_REMINDER_1H: "session_reminder_1h",
  PACKAGE_PURCHASED: "package_purchased",
  SESSION_REPORT_READY: "session_report_ready",
  GUIDE_ASSIGNMENT: "guide_assignment",
  GUIDE_SESSION_REMINDER: "guide_session_reminder",
  GUIDE_REPORT_REQUIRED: "guide_report_required",
  GUIDE_REPORT_OVERDUE: "guide_report_overdue",
  CALL_PARENT_ESCALATION: "call_parent_escalation",
  CALL_PARENT_FAILURE: "call_parent_failure",
  PAYMENT_FAILURE: "payment_failure",
  RECORDING_FAILURE: "recording_failure",
});

export const CHANNEL_POLICY = Object.freeze({
  email: [
    "booking_confirmed",
    "package_purchased",
    "session_report_ready",
    "booking_cancelled",
    "guide_reassigned",
    "session_reminder_1h",
    "guide_assignment",
    "guide_session_reminder",
    "guide_report_required",
    "guide_report_overdue",
    "call_parent_failure",
    "payment_failure",
    "recording_failure",
  ],
  sms: [
    "session_reminder_1h",
    "call_parent_escalation",
    "booking_cancelled",
    "guide_reassigned",
  ],
  voice: ["call_parent_escalation"],
});
