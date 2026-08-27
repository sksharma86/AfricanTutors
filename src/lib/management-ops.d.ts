export const MANAGEMENT_STATUSES: readonly string[];
export const MANAGEMENT_STATUS_LABEL: Record<string, string>;
export function calendarDateInTz(iso: string | null | undefined, tz: string): string | null;
export function todayDateInTz(tz: string, nowMs?: number): string | null;
export function sessionEndMs(booking: { scheduled_end?: string | null; scheduled_start?: string | null; duration_minutes?: number | null }): number | null;
export function isStudyHallLive(
  booking: { status?: string; scheduled_start?: string | null; scheduled_end?: string | null; duration_minutes?: number | null },
  presence: {
    student_first_joined_at?: string | null;
    tutor_first_joined_at?: string | null;
    student_last_seen_at?: string | null;
    tutor_last_seen_at?: string | null;
    student_last_left_at?: string | null;
    tutor_last_left_at?: string | null;
  } | null | undefined,
  nowMs?: number,
): boolean;
export function isOpenStudyHall(status: string): boolean;
export function isFinishedStatus(status: string): boolean;
export function isCancelledStatus(status: string): boolean;
export function managementOperationalStatus(
  booking: Record<string, unknown> | null | undefined,
  opts?: {
    presence?: {
      student_first_joined_at?: string | null;
      tutor_first_joined_at?: string | null;
      student_last_seen_at?: string | null;
      tutor_last_seen_at?: string | null;
      student_last_left_at?: string | null;
      tutor_last_left_at?: string | null;
    } | null | undefined;
    nowMs?: number;
    attention?: boolean;
  },
): "ready" | "live" | "needs_attention" | "completed" | "cancelled";
export function matchesStudyHallSearch(booking: Record<string, unknown>, query: string): boolean;
export function studyHallViewMembership(
  booking: Record<string, unknown>,
  view: string,
  opts: { tz: string; nowMs: number; presence?: unknown; attention?: boolean },
): boolean;
export function startsInLabel(iso: string | null | undefined, nowMs?: number): string | null;
export function collectNeedsAttention(input?: Record<string, unknown> | object): {
  id: string;
  kind: string;
  title: string;
  detail: string;
  bookingId?: string | null;
  href: string;
  action: string;
  severity: string;
}[];
export function comingUpBookings(
  bookings: Record<string, unknown>[],
  opts?: { presenceByBooking?: Record<string, unknown>; nowMs?: number; limit?: number; attentionIds?: Set<string> },
): Record<string, unknown>[];
