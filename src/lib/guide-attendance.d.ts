declare module "@/lib/guide-attendance.mjs" {
  export const CONFIRM_OPEN_LEAD_MIN: number;
  export const CONFIRM_DEADLINE_LEAD_MIN: number;
  export const CONFIRM_WINDOW_MIN: number;
  export const REPLACEMENT_CONFIRM_MIN: number;
  export const CRITICAL_LEAD_MIN: number;
  export const PROTECT_LEAD_MIN: number;
  export const COMPLIMENTARY_RECOVERY_MINUTES: number;
  export const COMP_HOUR_REFERENCE_PREFIX: string;
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
    offerCount?: number;
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

  export function complimentaryHourReference(bookingId: string): string;
  export function hasCurrentConfirmedCoverage(
    booking: { status?: string; tutor_id?: string | null } | null | undefined,
    assignment?: { status?: string; tutor_id?: string | null } | null,
  ): boolean;
  export function isCustomerProtectedAssignment(assignment: { resolution?: string | null; customer_protected_at?: string | null } | null | undefined): boolean;
  export function criticalAtMs(scheduledStart: string | null | undefined): number;
  export function protectAtMs(scheduledStart: string | null | undefined): number;
  export function isAtCriticalWindow(scheduledStart: string | null | undefined, nowMs?: number): boolean;
  export function isAtProtectWindow(scheduledStart: string | null | undefined, nowMs?: number): boolean;
  export function shouldProtectCustomer(opts?: {
    booking?: { status?: string; tutor_id?: string | null; scheduled_start?: string | null } | null;
    assignment?: { status?: string; tutor_id?: string | null } | null;
    nowMs?: number;
  }): { ok: boolean; reason?: string; idempotent?: boolean };
  export function criticalNotifyKey(bookingId: string): string;
  export function protectNotifyKey(bookingId: string): string;
  export function isCoverageCancellationReason(reason: string | null | undefined): boolean;
  export function coverageRestorationLine(opts: {
    isFreeTrial?: boolean | null;
    restoredMinutes?: number | null;
    restoredCreditCents?: number | null;
  }): string;

  export const E164_RE: RegExp;
  export function isE164(value: string | null | undefined): boolean;
  export type AttendanceBooking = {
    id: string;
    status?: string;
    tutor_id?: string | null;
    scheduled_start?: string | null;
    scheduled_end?: string | null;
    duration_minutes?: number | null;
    student_first_name?: string | null;
    student_first_names?: string[] | null;
    child_count?: number | null;
    attendance?: object | null;
    [key: string]: unknown;
  };
  export function sessionEndMs(booking: { scheduled_end?: string | null; scheduled_start?: string | null; duration_minutes?: number | null }): number;
  export function isContiguous(prev: object | null | undefined, next: object | null | undefined): boolean;
  export function confirmationBlocks(bookings: object[], opts?: { tutorId?: string | null }): AttendanceBooking[][];
  export function contiguousBlockContaining(bookings: object[], seedId: string, opts?: { tutorId?: string | null }): AttendanceBooking[];
  export function blockWindow(block: object[]): { startAt: number; openAt: number; deadlineAt: number } | null;
  export function shouldOpenIndependently(
    booking: object,
    previous: object | null,
    prevAssignment?: object | null,
    ownAssignment?: object | null,
  ): boolean;
  export function splitObligationRuns(block: object[], assignmentsByBooking?: Record<string, object | null>): AttendanceBooking[][];
  export function obligationBlockContaining(
    bookings: object[],
    seedId: string,
    opts?: { tutorId?: string | null; assignmentsByBooking?: Record<string, object | null> },
  ): AttendanceBooking[];
  export function expandOpenMembers(leader: object, bookings: object[], assignmentsByBooking?: Record<string, object | null>): AttendanceBooking[];
  export function attendanceNotifyKey(opts: { tutorId: string; firstBookingId: string; source?: string }): string;
  export function missedNotifyKey(opts: { tutorId: string; firstBookingId: string }): string;
  export function canConfirmAttendanceInBlock(opts: {
    booking: { status?: string; tutor_id?: string; scheduled_start?: string };
    actorId: string;
    assignment?: object | null;
    firstScheduledStart?: string | null;
    nowMs?: number;
  }): { ok: boolean; reason?: string; idempotent?: boolean };
  export function confirmBlockResult(opts: {
    bookings: object[];
    actorId: string;
    assignmentsByBooking?: Record<string, object | null>;
    nowMs?: number;
    seedId?: string | null;
  }): { confirmed: { id: string; idempotent: boolean }[]; skipped: { id: string; reason?: string }[] };
  export function guideConfirmBlockState(opts: { bookings: object[]; nowMs?: number }): { kind: string; block: AttendanceBooking[] };
  export function activeConfirmationBlock(
    bookings: object[],
    opts?: { nowMs?: number; tutorId?: string | null },
  ): { kind: string; block: AttendanceBooking[] };
  export function groupManagementCoverageIssues(items: object[], bookings?: object[]): object[];
}
