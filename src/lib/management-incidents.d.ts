declare module "@/lib/management-incidents.mjs" {
  export const INCIDENT_STATUSES: readonly string[];
  export const INCIDENT_TYPES: Record<string, string>;
  export const RESOLUTION_TYPES: Record<string, string>;
  export const RESOLUTION_SOURCES: Record<string, string>;
  export const RESOLUTION_STATUS_LABEL: Record<string, string>;
  export const INCIDENT_AUDIT_ACTIONS: readonly string[];
  export const COVERAGE_EMAIL_TYPES: readonly string[];
  export const STANDALONE_NOTIFY_TYPES: readonly string[];

  export type IncidentStatus = "open" | "resolved";
  export type IncidentSeverity = "critical" | "high" | "medium";
  export type ManagementIncident = {
    id: string;
    kind: "coverage" | "notify";
    bookingId: string | null;
    type: string;
    typeLabel: string;
    status: IncidentStatus;
    severity: IncidentSeverity;
    resolution_type: string | null;
    resolution_source: string | null;
    resolutionLabel: string;
    opened_at: string | null;
    resolved_at: string | null;
    occurredAt: string | null;
    childName: string;
    parentName: string | null;
    guideName: string | null;
    guideId: string | null;
    missedGuideId: string | null;
    scheduledStart: string | null;
    scheduledEnd: string | null;
    description: string;
    customerImpacting: boolean;
    complementaryHour: boolean;
    parentNotification: { kind: string; at: string | null; type: string | null };
    customerImpact: string;
    href: string;
    studyHallHref: string;
    timeline: { at: string; title: string; detail: string | null }[];
  };

  export function isActionableAttentionIssue(issue: { kind?: string; severity?: string } | null | undefined): boolean;
  export function coverageIncidentId(bookingId: string): string;
  export function notifyIncidentId(deliveryId: string): string;
  export function parseIncidentId(raw: string | null | undefined): {
    kind: "coverage" | "notify";
    bookingId: string | null;
    deliveryId: string | null;
  } | null;
  export function incidentHref(id: string): string;
  export function isIncidentAssignment(assignment: Record<string, unknown> | null | undefined): boolean;
  export function isIncidentAudit(row: { action?: string } | null | undefined): boolean;
  export function isStandaloneNotifyFailure(delivery: { status?: string; notification_type?: string } | null | undefined): boolean;
  export function isComplimentaryRecovery(row: { reference?: string | null; reason?: string | null } | null | undefined, bookingId?: string | null): boolean;
  export function bookingHasCoverageIncident(opts?: {
    booking?: Record<string, unknown> | null;
    assignments?: object[];
    offers?: object[];
    auditLogs?: object[];
    complimentary?: object[];
  }): boolean;
  export function incidentTimeline(incident: { timeline?: { at: string; title: string; detail: string | null }[] } | null | undefined): {
    at: string;
    title: string;
    detail: string | null;
  }[];
  export function buildCoverageIncident(opts?: {
    booking?: Record<string, unknown> | null;
    assignments?: object[];
    offers?: object[];
    auditLogs?: object[];
    emails?: object[];
    complimentary?: object[];
    guideNames?: Record<string, string>;
    nowMs?: number;
  }): ManagementIncident | null;
  export function buildNotifyIncident(opts?: {
    delivery?: Record<string, unknown> | null;
    booking?: Record<string, unknown> | null;
    nowMs?: number;
  }): ManagementIncident | null;
  export function collectOperationalIncidents(opts?: {
    bookings?: object[];
    assignmentsByBooking?: Record<string, object[]>;
    offersByBooking?: Record<string, object[]>;
    auditByBooking?: Record<string, object[]>;
    emailsByBooking?: Record<string, object[]>;
    complimentaryByBooking?: Record<string, object[]>;
    standaloneNotify?: object[];
    guideNames?: Record<string, string>;
    nowMs?: number;
  }): ManagementIncident[];
  export function filterIncidents(
    incidents?: ManagementIncident[],
    filters?: {
      status?: string;
      type?: string;
      severity?: string;
      dateFrom?: string;
      dateTo?: string;
      guideId?: string;
      query?: string;
      tz?: string;
    },
  ): ManagementIncident[];
  export function summarizeIncidents(incidents?: ManagementIncident[]): {
    total: number;
    resolvedAutomatically: number;
    managerIntervention: number;
    customerImpacting: number;
    open: number;
  };
  export function incidentGuideOptions(incidents?: ManagementIncident[]): { id: string; name: string }[];
  export function isRoutineSuccessfulActivity(opts?: {
    booking?: Record<string, unknown> | null;
    assignment?: Record<string, unknown> | null;
    payment?: Record<string, unknown> | null;
  }): boolean;
}
