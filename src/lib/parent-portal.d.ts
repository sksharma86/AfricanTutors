declare module "@/lib/parent-portal.mjs" {
  export const PARENT_PORTAL_NAV: readonly { label: string; href: string }[];
  export function childFirstName(fullName: string | null | undefined, fallback?: string): string;
  export function parentGuideLabel(booking: { tutor_display_name?: string | null; status?: string } | null | undefined): string | null;
  export function parentStatusLabel(booking: { status?: string; payment_status?: string; tutor_display_name?: string | null } | null | undefined): string;
  export function parentStudyHallLists<T extends { status: string; scheduled_start?: string | null; scheduled_end?: string | null }>(
    bookings: T[],
    nowMs?: number,
  ): { upcoming: T[]; past: T[]; cancelled: T[]; next: T | null };
  export function lastCompletedStudyHall<T extends { status: string; scheduled_start?: string | null; scheduled_end?: string | null }>(
    bookings: T[],
    nowMs?: number,
  ): T | null;
  export function parentPrimaryAction(
    bookings: { id: string; status: string; scheduled_start?: string | null; scheduled_end?: string | null }[],
    nowMs?: number,
  ): { kind: "join" | "book"; href: string; label: string; bookingId: string | null };
  export function parentJoinHint(
    booking: { status?: string; scheduled_start?: string | null; scheduled_end?: string | null } | null | undefined,
    nowMs?: number,
  ): { state: string; label: string | null };
  export function formatPrepaidHoursLabel(minutes: number): string;
  export function matchesParentStudyHallView(
    booking: { status: string; scheduled_start?: string | null; scheduled_end?: string | null },
    view: string,
    nowMs?: number,
  ): boolean;
  export function parentCanCancel(
    booking: { status?: string; scheduled_start?: string | null; scheduled_end?: string | null } | null | undefined,
    nowMs?: number,
  ): boolean;
  export function parentCanDispute(
    booking: { status?: string } | null | undefined,
    hasOpenIssue?: boolean,
  ): boolean;
  export function parentPaymentPurposeLabel(purpose: string | null | undefined): string;
  export function parentPaymentStatusLabel(status: string | null | undefined): string;
  export function parentPaymentLineLabel(booking: {
    is_free_trial?: boolean;
    payment_status?: string;
    status?: string;
  } | null | undefined): string;
  export function completedStudyHallsThisMonth(
    bookings: { status?: string; scheduled_start?: string | null }[] | null | undefined,
    nowMs?: number,
    timeZone?: string,
  ): { count: number; days: number[]; yearMonth: string; daysInMonth: number };
  export function parentHabitCopy(count: number): { title: string; body: string };
  export function parentSessionMinutes(booking: {
    duration_minutes?: number | null;
    scheduled_start?: string | null;
    scheduled_end?: string | null;
  } | null | undefined): number | null;
}
