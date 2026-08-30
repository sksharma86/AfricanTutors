declare module "@/lib/guide-attendance.mjs" {
  export const CONFIRM_OPEN_LEAD_MIN: number;
  export const CONFIRM_DEADLINE_LEAD_MIN: number;
  export const CONFIRM_WINDOW_MIN: number;
  export const REPLACEMENT_CONFIRM_MIN: number;
  export const ASSIGNMENT_STATUSES: readonly string[];
  export const ASSIGNMENT_SOURCES: readonly string[];
  export const COVERAGE_CANCEL_REASON: string;

  export function confirmationWindow(scheduledStart: string | null | undefined): {
    startAt: number;
    openAt: number;
    deadlineAt: number;
  } | null;
  export function t30DeadlineIso(scheduledStart: string | null | undefined): string | null;
  export function replacementDeadlineIso(requestedAt?: string | null, nowMs?: number): string;
  export function chooseOpenSource(opts: {
    scheduledStart: string | null | undefined;
    nowMs: number;
    isReplacement?: boolean;
  }): "t30" | "replacement" | "short_notice";
  export function openDeadlineIso(opts: {
    scheduledStart: string | null | undefined;
    source: string;
    requestedAt?: string | null;
    nowMs?: number;
  }): string | null;

  export type GuideAttendanceKind = "none" | "not_yet" | "awaiting" | "confirmed" | "missed";
  export function guideAttendanceState(opts: {
    status: string | null | undefined;
    scheduledStart: string | null | undefined;
    assignment?: object | null;
    nowMs?: number;
  }): { kind: GuideAttendanceKind; deadlineAt?: string; confirmedAt?: string | null; missedAt?: string | null; assignment?: unknown };
  export function guideAttendanceRowLabel(state: { kind: string } | null | undefined): string | null;

  export function canConfirmAttendance(opts: {
    bookingStatus: string | null | undefined;
    assignedTutorId: string | null | undefined;
    actorId: string | null | undefined;
    scheduledStart: string | null | undefined;
    assignment?: object | null;
    nowMs?: number;
  }): { ok: boolean; reason?: string; idempotent?: boolean };

  export function managementAttendanceIssue(opts?: {
    booking?: Record<string, unknown> | null;
    assignment?: Record<string, unknown> | null;
    nowMs?: number;
    assignmentsLoaded?: boolean;
  }): {
    kind: string;
    title: string;
    summary: string;
    detail: string | null;
    action: string;
    severity: string;
  } | null;

  export function currentAssignmentForBooking(
    assignments: object[] | null | undefined,
    booking: { id?: string; tutor_id?: string | null } | null | undefined,
  ): Record<string, unknown> | null;

  export function isCoverageCancellationReason(reason: string | null | undefined): boolean;
  export function coverageRestorationLine(opts: {
    isFreeTrial?: boolean | null;
    restoredMinutes?: number | null;
    restoredCreditCents?: number | null;
  }): string;
}
