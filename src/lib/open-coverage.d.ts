declare module "@/lib/open-coverage.mjs" {
  export const OPEN_COVERAGE_SOURCE: "emergency";
  export const OFFER_STATUSES: readonly string[];
  export const CLAIM_REASONS: {
    won: string;
    already_covered: string;
    expired: string;
    ineligible: string;
    overlap: string;
    cancelled: string;
    unauthorized: string;
  };
  export function openCoveragePath(bookingId: string): string;
  export function isSafeOpenCoveragePath(path: string | null | undefined): boolean;
  export function openCoverageUrl(appUrl: string | null | undefined, bookingId: string): string;
  export function openCoverageNotifyKey(opts: { bookingId: string; tutorId: string; searchKey: string }): string;
  export function openCoverageEmailNotifyKey(opts: { bookingId: string; tutorId: string; searchKey: string }): string;
  export function canStartCoverageSearch(opts?: {
    booking?: { status?: string; tutor_id?: string | null; scheduled_start?: string | null } | null;
    assignment?: { id?: string; status?: string; tutor_id?: string | null } | null;
  }): { ok: boolean; reason?: string; searchKey?: string };
  export function offerIsClaimable(
    offer: { status?: string } | null | undefined,
    opts?: { booking?: { status?: string; scheduled_start?: string | null } | null; nowMs?: number },
  ): { ok: boolean; reason?: string };
  export function claimResultMessage(reason: string | null | undefined): string;
  export function coverageSearchIssue(opts?: { offerCount?: number }): {
    kind: string;
    title: string;
    summary: string;
    detail: string;
    action: string;
    severity: string;
  };
  export function coverageRestoredIssue(opts?: { guideName?: string | null }): {
    kind: string;
    title: string;
    summary: string;
    detail: string;
    action: string;
    severity: string;
  };
  export function mapClaimRpcReason(reason: string | null | undefined): string;
  export function attendanceHistoryTitle(assignment: {
    source?: string | null;
    status?: string | null;
  } | null | undefined): string | null;
  export function isEligibleEmergencyCandidate(opts?: {
    candidateId?: string | null;
    currentTutorId?: string | null;
    approved?: boolean;
    role?: string;
    timezone?: string;
    available?: boolean;
  }): boolean;
}
