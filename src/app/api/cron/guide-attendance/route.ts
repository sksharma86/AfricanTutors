import { NextResponse, type NextRequest } from "next/server";

import { notifyGuideAttendanceRequest, notifyGuideConfirmationMissed } from "@/lib/notify";
import { getServiceSupabase } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Open T-30 confirmation windows and persist T-20 misses.
 * Idempotent via assignment rows + claim_email_delivery keys.
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
    ? (data as { opened: { id?: string; booking_id?: string; status?: string }[] }).opened
    : [];
  const missed = Array.isArray((data as { missed?: unknown[] } | null)?.missed)
    ? (data as { missed: { id?: string; booking_id?: string }[] }).missed
    : [];

  let requestsSent = 0;
  let alertsSent = 0;

  for (const row of opened) {
    if (!row?.id || !row.booking_id) continue;
    try {
      if (row.status === "missed") {
        const r = await notifyGuideConfirmationMissed(row.booking_id, row.id);
        if (r?.status === "sent") alertsSent += 1;
      } else {
        const r = await notifyGuideAttendanceRequest(row.booking_id, row.id);
        if (r?.status === "sent") requestsSent += 1;
      }
    } catch {
      /* delivery failure must not change attendance state */
    }
  }

  for (const row of missed) {
    if (!row?.id || !row.booking_id) continue;
    try {
      const r = await notifyGuideConfirmationMissed(row.booking_id, row.id);
      if (r?.status === "sent") alertsSent += 1;
    } catch {
      /* delivery failure must not change attendance state */
    }
  }

  return NextResponse.json({
    ok: true,
    opened: opened.length,
    missed: missed.length,
    requestsSent,
    alertsSent,
  });
}

export const GET = handle;
export const POST = handle;
