import { NextResponse, type NextRequest } from "next/server";

import { adminApiContext } from "@/lib/admin-service";
import { getRecordingAccessLink } from "@/lib/daily/client";
import { isDailyConfigured } from "@/lib/daily/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Admin-only secure recording playback. Verifies admin authorization, confirms
 * the recording exists in our DB (RLS: admin-only), then mints a SHORT-LIVED
 * Daily access link server-side. No permanent/public URL is ever stored or
 * returned; the Daily API secret never reaches the browser.
 */
export async function POST(request: NextRequest) {
  let ctx;
  try {
    ctx = await adminApiContext();
  } catch (e) {
    const m = e instanceof Error ? e.message : "";
    return NextResponse.json({ error: m }, { status: /authenticated/i.test(m) ? 401 : 403 });
  }
  const { supabase } = ctx;
  const body = await request.json().catch(() => null);
  if (!body || typeof body.recordingId !== "string") {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  // Confirm the recording row (admin-only RLS) and that it's a completed cloud recording.
  const { data: rec } = await supabase
    .from("session_recordings")
    .select("id, daily_recording_id, status")
    .eq("id", body.recordingId)
    .maybeSingle();
  if (!rec) return NextResponse.json({ error: "Recording not found." }, { status: 404 });
  if (rec.status !== "completed" || !rec.daily_recording_id) {
    return NextResponse.json({ error: "Recording is not available for playback yet.", status: rec.status }, { status: 409 });
  }
  if (!isDailyConfigured) {
    return NextResponse.json({ error: "Video service is not configured." }, { status: 503 });
  }

  const link = await getRecordingAccessLink(rec.daily_recording_id);
  if (!link) return NextResponse.json({ error: "Could not generate a secure link. Try again." }, { status: 502 });
  return NextResponse.json(link);
}
