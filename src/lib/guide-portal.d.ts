declare module "@/lib/guide-portal.mjs" {
  export const GUIDE_PORTAL_NAV: readonly { label: string; href: string }[];
  export function guideChildName(booking: { student_first_name?: string | null } | null | undefined, fallback?: string): string;
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
}
