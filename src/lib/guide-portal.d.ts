declare module "@/lib/guide-portal.mjs" {
  export const GUIDE_PORTAL_NAV: readonly { label: string; href: string }[];
  export function guideChildName(
    booking: {
      student_first_name?: string | null;
      student_first_names?: string[] | null;
      child_count?: number | null;
    } | null | undefined,
    fallback?: string,
  ): string;
  export function guideChildrenCaption(
    booking: { student_first_names?: string[] | null; child_count?: number | null } | null | undefined,
  ): string | null;
  export function guideStudyHallLists<T extends { status: string; scheduled_start?: string | null; scheduled_end?: string | null }>(
    bookings: T[],
    nowMs?: number,
    tz?: string,
  ): { upcoming: T[]; past: T[]; next: T | null; today: T[]; later: T[]; completed: T[]; cancelled: T[] };
  export function guideNeedsReport(
    booking: { status?: string; scheduled_start?: string | null; scheduled_end?: string | null } | null | undefined,
    reported?: boolean,
    nowMs?: number,
  ): boolean;
  export function unfinishedGuideReport<T extends { id: string; status: string; scheduled_start?: string | null; scheduled_end?: string | null }>(
    bookings: T[],
    reportedIds: Set<string> | string[],
    nowMs?: number,
  ): T | null;
  export function guideStartsInLabel(startISO: string | null | undefined, nowMs?: number): string | null;
  export function guideRowStatus(
    booking: { status: string; scheduled_start?: string | null; scheduled_end?: string | null },
    nowMs?: number,
  ): string;
  export function guideReportHref(bookingId: string): string;
  export function guideEarningStatusLabel(status: string | null | undefined): string;
  export function guideDayPart(nowMs?: number, tz?: string): string;
  export function guideDaySchedule<T extends { status: string; scheduled_start?: string | null }>(
    bookings: T[],
    nowMs?: number,
    tz?: string,
  ): T[];
  export function guideWeekSummary<T extends { status: string; scheduled_start?: string | null; duration_minutes?: number | null }>(
    bookings: T[],
    nowMs?: number,
    tz?: string,
  ): { count: number; hours: number; completed: number; upcoming: number; startKey: string; endKey: string };
  export function guideAvailabilitySummary(
    blocks: { day_of_week: number; start_time: string; end_time: string }[],
    exceptions: { starts_at: string; ends_at: string }[],
    nowMs?: number,
    tz?: string,
  ): {
    availableNow: boolean;
    availableToday: boolean;
    nextWindow: { when: string; range: string } | null;
    hasSchedule: boolean;
  };
  export function guideEarningsHomeSummary(
    earnings: { amount_cents: number; status: string; paid_at?: string | null }[],
    nowMs?: number,
    tz?: string,
    currency?: string,
  ): { outstanding: number; paidMonth: number; currency: string };
}
