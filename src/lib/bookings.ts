import type { BookingStatus } from "./booking-config";
import { partitionBookings as partitionBookingsJs } from "./bookings.mjs";

export interface TimedBooking {
  scheduled_start: string | null;
  scheduled_end?: string | null;
  status: BookingStatus;
}

export function partitionBookings<T extends TimedBooking>(
  bookings: T[],
  nowMs?: number,
): { upcoming: T[]; past: T[]; next: T | null } {
  return partitionBookingsJs(bookings, nowMs) as { upcoming: T[]; past: T[]; next: T | null };
}
