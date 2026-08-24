import { NextResponse, type NextRequest } from "next/server";

import { notifySessionReportReady } from "@/lib/notify";
import {
  GUIDE_NOTE_MAX,
  isFocusRating,
  isRedirectionLevel,
  WORK_SUMMARY_MAX,
} from "@/lib/session-report.mjs";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Guide submits a short post-session Study Hall report for a completed booking
 * they were assigned to. Authorization + one-per-booking rules live in the
 * SECURITY DEFINER RPC `submit_session_report`. Parents are notified via the
 * central Phase 6 email pipeline (best-effort, never blocks the response).
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.bookingId !== "string") {
    return NextResponse.json({ error: "A booking is required." }, { status: 400 });
  }

  const focus = typeof body.focusRating === "string" ? body.focusRating.trim() : "";
  const workSummary = typeof body.workSummary === "string" ? body.workSummary.trim() : "";
  const redirection = typeof body.redirectionLevel === "string" ? body.redirectionLevel.trim() : "";
  const guideNoteRaw = typeof body.guideNote === "string" ? body.guideNote.trim() : "";
  const guideNote = guideNoteRaw.length > 0 ? guideNoteRaw : null;

  if (!isFocusRating(focus)) {
    return NextResponse.json({ error: "Choose a focus rating." }, { status: 400 });
  }
  if (!isRedirectionLevel(redirection)) {
    return NextResponse.json({ error: "Choose a redirection level." }, { status: 400 });
  }
  if (!workSummary || workSummary.length > WORK_SUMMARY_MAX) {
    return NextResponse.json(
      { error: `What they worked on is required (1–${WORK_SUMMARY_MAX} characters).` },
      { status: 400 },
    );
  }
  if (guideNote && guideNote.length > GUIDE_NOTE_MAX) {
    return NextResponse.json(
      { error: `Guide note must be at most ${GUIDE_NOTE_MAX} characters.` },
      { status: 400 },
    );
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Not available." }, { status: 503 });
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { data, error } = await supabase.rpc("submit_session_report", {
    p_booking: body.bookingId,
    p_focus: focus,
    p_work_summary: workSummary,
    p_redirection: redirection,
    p_guide_note: guideNote,
  });

  if (error) {
    const msg = error.message || "";
    if (/already been submitted/i.test(msg)) {
      return NextResponse.json({ error: "A report has already been submitted for this session." }, { status: 409 });
    }
    if (/Not authorized|not authenticated/i.test(msg)) {
      return NextResponse.json({ error: "You can only report on your own assigned sessions." }, { status: 403 });
    }
    if (/completed Study Hall/i.test(msg)) {
      return NextResponse.json(
        { error: "Reports can only be submitted after the Study Hall is completed." },
        { status: 400 },
      );
    }
    if (/Booking not found|no assigned Guide/i.test(msg)) {
      return NextResponse.json({ error: "This session can't accept a report." }, { status: 400 });
    }
    if (/focus rating|redirection|worked on|Guide note/i.test(msg)) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    return NextResponse.json({ error: "Unable to submit the report." }, { status: 400 });
  }

  void notifySessionReportReady(body.bookingId, data as string);

  return NextResponse.json({ id: data, status: "submitted" });
}
