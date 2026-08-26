export function partitionBookings<T extends { scheduled_start?: string | null; scheduled_end?: string | null; status: string }>(
  bookings: T[],
  nowMs?: number,
): {
  upcoming: T[];
  past: T[];
  next: T | null;
};
