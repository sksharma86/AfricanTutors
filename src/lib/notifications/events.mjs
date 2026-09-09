/**
 * Canonical Study Hall notification event types.
 * Used for documentation, tests, and future audit tagging.
 *
 * Historical files/comments may say "PR8" for this spine. Original product
 * roadmap PR7 extends this catalog — do not rename historical migrations.
 *
 * PR7B wires Study Hall 365 parent-email lifecycle after membership upsert.
 * PR7C wires payment_failure parent email after 365 invoice sync (email only).
 * PR7D wires customer no-show parent + Guide email after the PR6 RPC commits.
 * Parent SMS for no-show stays catalog-only until PR7F (consent).
 * PR7E hardens delivery retry/stale recovery without new event types.
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
  COVERAGE_FAILURE_PROTECTION: "coverage_failure_protection",
  GUIDE_ATTENDANCE_WHATSAPP: "guide_attendance_whatsapp",
  GUIDE_ATTENDANCE_CRITICAL: "guide_attendance_critical",
  GUIDE_OPEN_COVERAGE: "guide_open_coverage",
  /** PR7B — parent email after authoritative 365 membership sync. */
  STUDY_HALL_365_STARTED: "study_hall_365_started",
  STUDY_HALL_365_RENEWED: "study_hall_365_renewed",
  STUDY_HALL_365_CANCELLATION_SCHEDULED: "study_hall_365_cancellation_scheduled",
  STUDY_HALL_365_RESUMED: "study_hall_365_resumed",
  STUDY_HALL_365_ENDED: "study_hall_365_ended",
  /** PR7D — parent email after authoritative customer no-show. SMS later (PR7F). */
  CUSTOMER_NO_SHOW_PARENT: "customer_no_show_parent",
  /** PR7D — Guide email after authoritative customer no-show. Never a management success email. */
  CUSTOMER_NO_SHOW_GUIDE: "customer_no_show_guide",
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
    "guide_open_coverage",
    "coverage_cancellation",
    "coverage_failure_protection",
    // PR7B: parent email after 365 membership upsert. Still not SMS/WhatsApp.
    "study_hall_365_started",
    "study_hall_365_renewed",
    "study_hall_365_cancellation_scheduled",
    "study_hall_365_resumed",
    "study_hall_365_ended",
    "customer_no_show_parent",
    "customer_no_show_guide",
  ],
  /**
   * Optional / later Guide operational alerts. V1 does not require WhatsApp.
   * Not parent SMS. Not inbound confirmation.
   */
  whatsapp: [
    "guide_attendance_request",
    "guide_attendance_whatsapp",
    "guide_open_coverage",
  ],
  sms: [
    "session_reminder_1h",
    "call_parent_escalation",
    "booking_cancelled",
    "coverage_cancellation",
    "coverage_failure_protection",
    // Successful Guide reassignment must NEVER SMS the parent.
    // Catalog allows payment_failure SMS; PR7C does not send it (no consent/opt-out).
    // Catalog allows customer_no_show_parent SMS; PR7D does not send it (PR7F consent).
    "payment_failure",
    "customer_no_show_parent",
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
  /**
   * PR7 recipient matrix. 365 parent email is wired in PR7B. PR7C wires
   * payment_failure parent email only (SMS cataloged, not sent). PR7D wires
   * customer no-show parent + Guide email (parent SMS cataloged, not sent).
   * Management must not get no-show success.
   */
  pr7_lifecycle: Object.freeze({
    study_hall_365_started: Object.freeze({ parent: ["email"], guide: [], manager: [] }),
    study_hall_365_renewed: Object.freeze({ parent: ["email"], guide: [], manager: [] }),
    study_hall_365_cancellation_scheduled: Object.freeze({ parent: ["email"], guide: [], manager: [] }),
    study_hall_365_resumed: Object.freeze({ parent: ["email"], guide: [], manager: [] }),
    study_hall_365_ended: Object.freeze({ parent: ["email"], guide: [], manager: [] }),
    payment_failure: Object.freeze({ parent: ["email", "sms"], guide: [], manager: [] }),
    customer_no_show_parent: Object.freeze({ parent: ["email", "sms"], guide: [], manager: [] }),
    customer_no_show_guide: Object.freeze({ parent: [], guide: ["email"], manager: [] }),
  }),
  /**
   * PR7D shipped channels. Catalog still lists parent SMS; this slice sends
   * email only. No Guide SMS/WhatsApp. No Management success email.
   */
  pr7d_customer_no_show: Object.freeze({
    parent: ["email"],
    guide: ["email"],
    manager: [],
  }),
});
