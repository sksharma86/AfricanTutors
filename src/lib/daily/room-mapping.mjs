/**
 * Deterministic mapping between an African Tutors booking id and its Daily room
 * name (Phase 5A: `at-<uuid-without-hyphens>`). Used to AUTHORITATIVELY derive
 * the booking from a Daily webhook's room name — never from client input — so a
 * recording from room A can never be attached to booking B. Pure ESM (+ .d.ts)
 * so the mapping is unit-testable.
 */

/** booking uuid → room name. */
export function bookingToRoom(bookingId) {
  return "at-" + String(bookingId).replace(/-/g, "");
}

/** room name → booking uuid, or null if the name is not a valid AT room. */
export function roomToBooking(room) {
  if (!room || typeof room !== "string" || !room.startsWith("at-")) return null;
  const hex = room.slice(3);
  if (!/^[0-9a-f]{32}$/i.test(hex)) return null;
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
