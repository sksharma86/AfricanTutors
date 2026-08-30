import { NextResponse, type NextRequest } from "next/server";

import { criticalNotifyKey, obligationBlockContaining } from "@/lib/guide-attendance.mjs";
import {
  notifyCoverageFailureProtection,
  notifyGuideAttendanceRequest,
  notifyGuideConfirmationMissed,
  notifyAdminAlert,
} from "@/lib/notify";
import { getServiceSupabase } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Open T-30 confirmation windows and persist T-20 misses.
 * One WhatsApp + one email per contiguous block. Idempotent.
 * Does not cancel, reassign, or refund.
 */
async function handle(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Scheduling is not configured (CRON_SECRET unset)." }, { status: 503 });
  }
  const bearer = request.headers.get("authorization")?.startsWith("Bearer ")
    ? request.headers.get("authorization")!.slice(7)
    : null;
  if (request.headers.get("x-cron-secret") !== secret && bearer !== secret) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const service = getServiceSupabase();
  const { data, error } = await service.rpc("sweep_guide_attendance");
  if (error) {
    if (/could not find|does not exist|schema cache/i.test(error.message)) {
      return NextResponse.json({ ok: true, skipped: true, reason: "migration_pending" });
    }
    return NextResponse.json({ error: "Attendance sweep failed." }, { status: 500 });
  }

  const opened = Array.isArray((data as { opened?: unknown[] } | null)?.opened)
    ? (data as { opened: { id?: string; booking_id?: string; tutor_id?: string; status?: string; source?: string }[] }).opened
    : [];
  const missed = Array.isArray((data as { missed?: unknown[] } | null)?.missed)
    ? (data as { missed: { id?: string; booking_id?: string; tutor_id?: string }[] }).missed
    : [];
  const critical = Array.isArray((data as { critical?: unknown[] } | null)?.critical)
    ? (data as { critical: { booking_id?: string; tutor_id?: string; scheduled_start?: string }[] }).critical
    : [];
  const protect = Array.isArray((data as { protect?: unknown[] } | null)?.protect)
    ? (data as { protect: { booking_id?: string; tutor_id?: string }[] }).protect
    : [];

  let requestsSent = 0;
  let alertsSent = 0;
  let criticalAlerts = 0;
  let protectedCount = 0;
  const notifiedLeaders = new Set<string>();
  const missedLeaders = new Set<string>();

  async function hallsForTutor(tutorId: string) {
    const { data: halls } = await service
      .from("bookings")
      .select("id, tutor_id, scheduled_start, scheduled_end, status")
      .eq("tutor_id", tutorId)
      .eq("status", "confirmed");
    const { data: atts } = await service
      .from("guide_attendance_assignments")
      .select("booking_id, status, tutor_id")
      .eq("tutor_id", tutorId)
      .in("status", ["awaiting", "confirmed", "missed"]);
    const byBooking: Record<string, { status?: string }> = {};
    for (const a of atts ?? []) {
      if (a?.booking_id) byBooking[a.booking_id] = a;
    }
    return {
      halls: (halls ?? []).map((h) => ({ ...h, attendance: byBooking[h.id] ?? null })),
      assignmentsByBooking: byBooking,
    };
  }

  function blockFor(
    halls: { id: string; scheduled_end?: string | null }[],
    bookingId: string,
    tutorId: string | undefined,
    assignmentsByBooking: Record<string, { status?: string }>,
  ) {
    return obligationBlockContaining(halls, bookingId, { tutorId, assignmentsByBooking });
  }

  for (const row of opened) {
    if (!row?.id || !row.booking_id) continue;
    try {
      if (row.status === "missed") {
        const { halls, assignmentsByBooking } = row.tutor_id
          ? await hallsForTutor(row.tutor_id)
          : { halls: [], assignmentsByBooking: {} };
        const block = blockFor(halls, row.booking_id, row.tutor_id, assignmentsByBooking);
        const first = block[0] ?? { id: row.booking_id };
        if (missedLeaders.has(first.id)) continue;
        missedLeaders.add(first.id);
        const r = await notifyGuideConfirmationMissed(first.id, row.id, {
          count: Math.max(block.length, 1),
          firstBookingId: first.id,
          tutorId: row.tutor_id,
        });
        if (r?.status === "sent") alertsSent += 1;
        continue;
      }
      const { halls, assignmentsByBooking } = row.tutor_id
        ? await hallsForTutor(row.tutor_id)
        : { halls: [], assignmentsByBooking: {} };
      const block = blockFor(halls, row.booking_id, row.tutor_id, assignmentsByBooking);
      const first = block[0] ?? { id: row.booking_id, scheduled_end: null };
      if (notifiedLeaders.has(first.id)) continue;
      notifiedLeaders.add(first.id);
      const r = await notifyGuideAttendanceRequest(first.id, row.id, {
        count: Math.max(block.length, 1),
        endISO: block[block.length - 1]?.scheduled_end ?? null,
        firstBookingId: first.id,
        replacement: row.source === "replacement" || row.source === "short_notice",
      });
      if (r?.status === "sent") requestsSent += 1;
    } catch {
      /* delivery failure must not change attendance state */
    }
  }

  for (const row of missed) {
    if (!row?.id || !row.booking_id) continue;
    try {
      const { halls, assignmentsByBooking } = row.tutor_id
        ? await hallsForTutor(row.tutor_id)
        : { halls: [], assignmentsByBooking: {} };
      const block = blockFor(halls, row.booking_id, row.tutor_id, assignmentsByBooking);
      const first = block[0] ?? { id: row.booking_id };
      if (missedLeaders.has(first.id)) continue;
      missedLeaders.add(first.id);
      const r = await notifyGuideConfirmationMissed(first.id, row.id, {
        count: Math.max(block.length, 1),
        firstBookingId: first.id,
        tutorId: row.tutor_id,
      });
      if (r?.status === "sent") alertsSent += 1;
    } catch {
      /* delivery failure must not change attendance state */
    }
  }

  const seenCritical = new Set<string>();
  for (const row of critical) {
    if (!row?.booking_id || seenCritical.has(row.booking_id)) continue;
    seenCritical.add(row.booking_id);
    try {
      const r = await notifyAdminAlert(criticalNotifyKey(row.booking_id), {
        title: "Critical coverage failure",
        summary: "A Study Hall starts within 10 minutes and has no current confirmed Guide.",
        lines: [
          `Booking: ${row.booking_id}`,
          row.scheduled_start ? `Start: ${row.scheduled_start}` : null,
          row.tutor_id ? `Current Guide: ${row.tutor_id}` : "No confirmed Guide",
        ].filter(Boolean) as string[],
      });
      if (r?.status === "sent") criticalAlerts += 1;
    } catch {
      /* Control Tower remains the live surface */
    }
  }

  const seenProtect = new Set<string>();
  for (const row of protect) {
    if (!row?.booking_id || seenProtect.has(row.booking_id)) continue;
    seenProtect.add(row.booking_id);
    try {
      const { data: result, error } = await service.rpc("protect_unconfirmed_booking", {
        p_booking: row.booking_id,
      });
      if (error) continue;
      const payload = (result ?? {}) as {
        status?: string;
        reason?: string;
        restored_minutes?: number;
        restored_credit_cents?: number;
        complimentary_minutes?: number;
        is_free_trial?: boolean;
      };
      if (payload.status === "cancelled" && payload.reason === "customer_protected") {
        protectedCount += 1;
        await notifyCoverageFailureProtection(row.booking_id, {
          isFreeTrial: Boolean(payload.is_free_trial),
          restoredMinutes: payload.restored_minutes ?? null,
          restoredCreditCents: payload.restored_credit_cents ?? null,
        });
      }
    } catch {
      /* retries are safe; protect RPC is idempotent */
    }
  }

  return NextResponse.json({
    ok: true,
    opened: opened.length,
    missed: missed.length,
    critical: critical.length,
    protect: protect.length,
    requestsSent,
    alertsSent,
    criticalAlerts,
    protectedCount,
  });
}

export const GET = handle;
export const POST = handle;
