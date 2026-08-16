import type { BookingStatus } from "./booking-config";

export interface TimedBooking {
  scheduled_start: string | null;
  status: BookingStatus;
}

/**
 * Splits bookings into upcoming / past and finds the next scheduled one.
 * Kept out of component render bodies so the current-time read stays pure
 * from the components' perspective.
 */
export function partitionBookings<T extends TimedBooking>(bookings: T[]): {
  upcoming: T[];
  past: T[];
  next: T | null;
} {
  const now = Date.now();
  const isFuture = (b: T) => !b.scheduled_start || new Date(b.scheduled_start).getTime() >= now;
  const upcoming = bookings.filter((b) => (b.status === "confirmed" || b.status === "pending") && isFuture(b));
  const past = bookings.filter(
    (b) =>
      b.status === "completed" ||
      b.status === "cancelled" ||
      b.status === "no_show" ||
      (b.scheduled_start != null && new Date(b.scheduled_start).getTime() < now && b.status === "confirmed"),
  );
  const next = upcoming.find((b) => b.scheduled_start) ?? null;
  return { upcoming, past, next };
}
