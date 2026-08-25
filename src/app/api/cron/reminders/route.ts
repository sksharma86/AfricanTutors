import { NextResponse, type NextRequest } from "next/server";

import {
  notifyGuideReportOverdue,
  notifyGuideReportRequired,
  notifyReminder,
} from "@/lib/notify";
import { reminder1hWindow } from "@/lib/notifications/reminder-policy.mjs";
import { getServiceSupabase } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Study Hall notification cron (PR8).
 *
 * Protected by CRON_SECRET. Idempotent via claim_email_delivery keys.
 *
 * 1) ~1h session reminders (parent email+SMS, Guide email) when scheduled_start
 *    is 50–70 minutes away. No 24h reminder. No T−5 “room open” ping.
 * 2) Guide report required (~15–120 min after scheduled_end, completed, no report).
 * 3) Guide report overdue (+ admin alert) after ~24h without a report.
 *
 * Wire via Vercel Cron (~every 15 minutes) to /api/cron/reminders.
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
  const now = Date.now();
  const { fromISO, toISO } = reminder1hWindow(now);

  let remindersSent = 0;
  let reportsNudged = 0;
  let reportsOverdue = 0;

  try {
    // --- 1h reminders -------------------------------------------------------
    const { data: due } = await service
      .from("bookings")
      .select("id")
      .eq("status", "confirmed")
      .not("scheduled_start", "is", null)
      .gte("scheduled_start", fromISO)
      .lte("scheduled_start", toISO)
      .limit(500);

    for (const b of due ?? []) {
      for (const role of ["customer", "tutor"] as const) {
        const r = await notifyReminder(b.id, role, "1h");
        if (r?.status === "sent") remindersSent += 1;
      }
    }

    // --- Guide report required / overdue (completed, no session_reports row) -
    const endFrom = new Date(now - 2 * 60 * 60_000).toISOString();
    const endTo = new Date(now - 15 * 60_000).toISOString();
    const overdueBefore = new Date(now - 24 * 60 * 60_000).toISOString();

    async function withoutReport(endGte: string | null, endLte: string) {
      let q = service
        .from("bookings")
        .select("id")
        .eq("status", "completed")
        .not("scheduled_end", "is", null)
        .lte("scheduled_end", endLte)
        .limit(200);
      if (endGte) q = q.gte("scheduled_end", endGte);
      const { data } = await q;
      const out: string[] = [];
      for (const b of data ?? []) {
        const { data: rep } = await service.from("session_reports").select("id").eq("booking_id", b.id).maybeSingle();
        if (!rep) out.push(b.id);
      }
      return out;
    }

    const needReport = await withoutReport(endFrom, endTo);
    for (const id of needReport) {
      const r = await notifyGuideReportRequired(id);
      if (r?.status === "sent") reportsNudged += 1;
    }

    const overdue = await withoutReport(null, overdueBefore);
    for (const id of overdue) {
      const r = await notifyGuideReportOverdue(id);
      if (r?.status === "sent") reportsOverdue += 1;
    }
  } catch {
    return NextResponse.json({ error: "Notification sweep failed." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    remindersSent,
    reportsNudged,
    reportsOverdue,
    window: { fromISO, toISO },
  });
}

export const GET = handle;
export const POST = handle;
