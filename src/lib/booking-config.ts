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

/**
 * How long a paid booking's slot is held while awaiting payment before it is
 * released (status → `expired`). Development default — NOT final public policy.
 * Mirrors the hold window in `create_booking` (see 0004 migration).
 */
export const PAYMENT_HOLD_MINUTES = 15;

export const BOOKING_STATUSES = [
  "pending",
  "confirmed",
  "completed",
  "cancelled",
  "no_show",
  "expired",
] as const;

export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const BOOKING_STATUS_LABEL: Record<BookingStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No-show",
  expired: "Expired",
};
