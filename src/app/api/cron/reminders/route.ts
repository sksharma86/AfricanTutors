import { NextResponse, type NextRequest } from "next/server";

import { notifyReminder } from "@/lib/notify";
import { getServiceSupabase } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Session-reminder cron. Secret-protected (CRON_SECRET), reusing the Phase 4D
 * pattern. Finds confirmed, scheduled, upcoming bookings and sends customer +
 * tutor reminders. Idempotent: each reminder is claimed under a stable key
 * (`reminder-<kind>:<booking>:<role>`) so running twice never double-sends.
 *
 * Windows (server time), window-tolerant so exact-second scheduling isn't needed:
 *   - "24h": booking starts within the next 24h but more than 1h out (sent once
 *     when it enters the day-before window).
 *   - "1h":  booking starts within the next hour.
 *
 * Wire to a scheduler (Vercel Cron / Supabase pg_cron) at ~15-minute cadence.
 */
async function handle(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "Scheduling is not configured (CRON_SECRET unset)." }, { status: 503 });
  const bearer = request.headers.get("authorization")?.startsWith("Bearer ") ? request.headers.get("authorization")!.slice(7) : null;
  if (request.headers.get("x-cron-secret") !== secret && bearer !== secret) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const service = getServiceSupabase();
  const nowISO = new Date().toISOString();
  const in1hISO = new Date(Date.now() + 60 * 60_000).toISOString();
  const in24hISO = new Date(Date.now() + 24 * 60 * 60_000).toISOString();

  async function due(fromISO: string, toISO: string) {
    const { data } = await service
      .from("bookings")
      .select("id")
      .eq("status", "confirmed")
      .not("scheduled_start", "is", null)
      .gt("scheduled_start", fromISO)
      .lte("scheduled_start", toISO)
      .limit(500);
    return (data ?? []) as { id: string }[];
  }

  let sent = 0;
  const run = async (bookings: { id: string }[], kind: "24h" | "1h") => {
    for (const b of bookings) {
      for (const role of ["customer", "tutor"] as const) {
        const r = await notifyReminder(b.id, role, kind);
        if (r?.status === "sent" || r?.status === "skipped") sent += r.status === "sent" ? 1 : 0;
      }
    }
  };

  try {
    await run(await due(in1hISO, in24hISO), "24h"); // day-before window (1h..24h out)
    await run(await due(nowISO, in1hISO), "1h"); // final hour
  } catch {
    return NextResponse.json({ error: "Reminder sweep failed." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, sent });
}

export const GET = handle;
export const POST = handle;
