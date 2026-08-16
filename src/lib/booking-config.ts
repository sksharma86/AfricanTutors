/**
 * Booking policy configuration. These are deliberately centralized, configurable
 * constants rather than business policy scattered across the codebase.
 *
 * Cancellation / rescheduling / refund policy is intentionally NOT encoded here
 * — it remains an owner decision before launch (see DECISIONS.md).
 */

/** How far ahead a session may be booked. */
export const BOOKING_HORIZON_DAYS = 21;

/** Minimum lead time before a session can start. */
export const MIN_BOOKING_NOTICE_MINUTES = 120;

export const BOOKING_STATUSES = [
  "pending",
  "confirmed",
  "completed",
  "cancelled",
  "no_show",
] as const;

export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const BOOKING_STATUS_LABEL: Record<BookingStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No-show",
};
