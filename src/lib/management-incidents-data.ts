import "server-only";

import {
  collectOperationalIncidents,
  INCIDENT_AUDIT_ACTIONS,
  isIncidentAssignment,
  isStandaloneNotifyFailure,
  parseIncidentId,
  STANDALONE_NOTIFY_TYPES,
} from "@/lib/management-incidents.mjs";
import { missingHouseholdColumns } from "@/lib/household-children.mjs";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

type SB = NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>;

const BOOKING_SELECT =
  "id, public_reference, account_id, student_id, tutor_id, student_first_name, student_first_names, child_count, tutor_display_name, scheduled_start, scheduled_end, duration_minutes, status, cancelled_at, is_free_trial, payment_status";
const BOOKING_SELECT_LEGACY =
  "id, public_reference, account_id, student_id, tutor_id, student_first_name, tutor_display_name, scheduled_start, scheduled_end, duration_minutes, status, cancelled_at, is_free_trial, payment_status";
const ASSIGNMENT_SELECT =
  "id, booking_id, tutor_id, source, status, requested_at, deadline_at, confirmed_at, missed_at, resolved_at, resolution, created_at, critical_at, customer_protected_at";

function groupByBooking<T extends { booking_id?: string | null }>(rows: T[] | null | undefined) {
  const map: Record<string, T[]> = {};
  for (const row of rows ?? []) {
    if (!row?.booking_id) continue;
    (map[row.booking_id] ??= []).push(row);
  }
  return map;
}

async function loadBookingsByIds(supabase: SB, ids: string[]) {
  if (!ids.length) return [] as Record<string, unknown>[];
  const first = await supabase.from("bookings").select(BOOKING_SELECT).in("id", ids);
  const res =
    first.error && missingHouseholdColumns(first.error)
      ? await supabase.from("bookings").select(BOOKING_SELECT_LEGACY).in("id", ids)
      : first;
  return (res.data ?? []) as Record<string, unknown>[];
}

async function loadGuideNames(supabase: SB, tutorIds: string[]) {
  const ids = Array.from(new Set(tutorIds.filter(Boolean)));
  const names: Record<string, string> = {};
  if (!ids.length) return names;
  const { data } = await supabase.from("profiles").select("id, display_name").in("id", ids);
  for (const row of data ?? []) {
    if (row.id && row.display_name) names[row.id as string] = row.display_name as string;
  }
  return names;
}

async function attachParents(supabase: SB, bookings: Record<string, unknown>[]) {
  const parentIds = Array.from(
    new Set(bookings.map((b) => b.account_id as string | undefined).filter((id): id is string => Boolean(id))),
  );
  if (!parentIds.length) return bookings;
  const { data } = await supabase.from("profiles").select("id, display_name").in("id", parentIds);
  const parentName = new Map((data ?? []).map((p) => [p.id as string, (p.display_name as string | null) ?? null]));
  return bookings.map((b) => ({
    ...b,
    parent_name: parentName.get(b.account_id as string) ?? null,
  }));
}

export async function loadManagementIncidents(supabase: SB, nowMs = Date.now()) {
  const [assignRes, offerRes, auditRes, emailRes] = await Promise.all([
    supabase
      .from("guide_attendance_assignments")
      .select(ASSIGNMENT_SELECT)
      .order("created_at", { ascending: false })
      .limit(500)
      .then(
        (r) => r,
        () => ({ data: null, error: { message: "unavailable" } }),
      ),
    supabase
      .from("guide_open_coverage_offers")
      .select("id, booking_id, tutor_id, status, created_at, claimed_at, closed_at, close_reason")
      .order("created_at", { ascending: false })
      .limit(800)
      .then(
        (r) => r,
        () => ({ data: null, error: { message: "unavailable" } }),
      ),
    supabase
      .from("financial_audit_log")
      .select("id, action, entity_id, new_state, created_at, reason")
      .in("action", [...INCIDENT_AUDIT_ACTIONS])
      .order("created_at", { ascending: false })
      .limit(400)
      .then(
        (r) => r,
        () => ({ data: null, error: { message: "unavailable" } }),
      ),
    supabase
      .from("email_deliveries")
      .select("id, notification_type, to_email, booking_id, status, error, created_at, updated_at")
      .in("notification_type", [...STANDALONE_NOTIFY_TYPES, "guide_open_coverage", "guide_attendance_request", "guide_confirmation_missed"])
      .order("updated_at", { ascending: false })
      .limit(200)
      .then(
        (r) => r,
        () => ({ data: null, error: { message: "unavailable" } }),
      ),
  ]);

  const seedAssignments = !assignRes.error ? ((assignRes.data ?? []) as Record<string, unknown>[]) : [];
  const seedOffers = !offerRes.error ? ((offerRes.data ?? []) as Record<string, unknown>[]) : [];
  const seedAudit = !auditRes.error ? ((auditRes.data ?? []) as Record<string, unknown>[]) : [];
  const seedEmail = !emailRes.error ? ((emailRes.data ?? []) as Record<string, unknown>[]) : [];

  const bookingIds = new Set<string>();
  for (const row of seedAssignments) {
    if (isIncidentAssignment(row) && row.booking_id) bookingIds.add(row.booking_id as string);
  }
  for (const row of seedOffers) {
    if (row.booking_id) bookingIds.add(row.booking_id as string);
  }
  for (const row of seedAudit) {
    if (row.entity_id) bookingIds.add(row.entity_id as string);
  }
  for (const row of seedEmail) {
    if (isStandaloneNotifyFailure(row) && row.booking_id) bookingIds.add(row.booking_id as string);
  }

  const ids = [...bookingIds];
  let bookings = await loadBookingsByIds(supabase, ids);
  bookings = await attachParents(supabase, bookings);

  let assignments = seedAssignments.filter((a) => a.booking_id && bookingIds.has(a.booking_id as string));
  if (ids.length) {
    const fullAssign = await supabase
      .from("guide_attendance_assignments")
      .select(ASSIGNMENT_SELECT)
      .in("booking_id", ids)
      .then(
        (r) => r,
        () => ({ data: null, error: { message: "unavailable" } }),
      );
    if (!fullAssign.error) assignments = (fullAssign.data ?? []) as Record<string, unknown>[];
  }

  let offers = seedOffers.filter((o) => o.booking_id && bookingIds.has(o.booking_id as string));
  if (ids.length) {
    const fullOffers = await supabase
      .from("guide_open_coverage_offers")
      .select("id, booking_id, tutor_id, status, created_at, claimed_at, closed_at, close_reason")
      .in("booking_id", ids)
      .then(
        (r) => r,
        () => ({ data: null, error: { message: "unavailable" } }),
      );
    if (!fullOffers.error) offers = (fullOffers.data ?? []) as Record<string, unknown>[];
  }

  const auditLogs = seedAudit
    .filter((row) => row.entity_id && bookingIds.has(row.entity_id as string))
    .map((row) => ({ ...row, booking_id: row.entity_id }));

  let emails = seedEmail.filter((e) => !e.booking_id || bookingIds.has(e.booking_id as string));
  if (ids.length) {
    const fullEmail = await supabase
      .from("email_deliveries")
      .select("id, notification_type, to_email, booking_id, status, error, created_at, updated_at")
      .in("booking_id", ids)
      .order("updated_at", { ascending: false })
      .limit(400)
      .then(
        (r) => r,
        () => ({ data: null, error: { message: "unavailable" } }),
      );
    if (!fullEmail.error) emails = (fullEmail.data ?? []) as Record<string, unknown>[];
  }

  let complimentary: Record<string, unknown>[] = [];
  if (ids.length) {
    const ledger = await supabase
      .from("package_minute_ledger")
      .select("id, booking_id, minutes_delta, reference, reason, created_at")
      .in("booking_id", ids)
      .then(
        (r) => r,
        () => ({ data: null, error: { message: "unavailable" } }),
      );
    if (!ledger.error) complimentary = (ledger.data ?? []) as Record<string, unknown>[];
  }

  const tutorIds = [
    ...assignments.map((a) => a.tutor_id as string),
    ...offers.map((o) => o.tutor_id as string),
    ...bookings.map((b) => b.tutor_id as string),
  ];
  const guideNames = await loadGuideNames(supabase, tutorIds);

  const incidents = collectOperationalIncidents({
    bookings,
    assignmentsByBooking: groupByBooking(assignments as { booking_id?: string }[]),
    offersByBooking: groupByBooking(offers as { booking_id?: string }[]),
    auditByBooking: groupByBooking(auditLogs as { booking_id?: string }[]),
    emailsByBooking: groupByBooking(emails as { booking_id?: string }[]),
    complimentaryByBooking: groupByBooking(complimentary as { booking_id?: string }[]),
    standaloneNotify: emails.filter((e) => isStandaloneNotifyFailure(e)),
    guideNames,
    nowMs,
  });

  return { incidents, bookings, guideNames };
}

export async function loadManagementIncident(supabase: SB, incidentId: string, nowMs = Date.now()) {
  const parsed = parseIncidentId(incidentId);
  if (!parsed) return null;
  const { incidents } = await loadManagementIncidents(supabase, nowMs);
  return incidents.find((i) => i.id === incidentId) ?? null;
}
