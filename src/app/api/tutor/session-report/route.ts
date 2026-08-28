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

type ChildReportInput = {
  studentId: string;
  focusRating: string;
  workSummary: string;
  redirectionLevel: string;
  guideNote: string | null;
};

function parseChildReports(raw: unknown): ChildReportInput[] | null {
  if (!Array.isArray(raw) || raw.length < 1) return null;
  const out: ChildReportInput[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") return null;
    const r = row as Record<string, unknown>;
    if (typeof r.studentId !== "string") return null;
    const focus = typeof r.focusRating === "string" ? r.focusRating.trim() : "";
    const workSummary = typeof r.workSummary === "string" ? r.workSummary.trim() : "";
    const redirection = typeof r.redirectionLevel === "string" ? r.redirectionLevel.trim() : "";
    const guideNoteRaw = typeof r.guideNote === "string" ? r.guideNote.trim() : "";
    if (!isFocusRating(focus) || !isRedirectionLevel(redirection)) return null;
    if (!workSummary || workSummary.length > WORK_SUMMARY_MAX) return null;
    if (guideNoteRaw && guideNoteRaw.length > GUIDE_NOTE_MAX) return null;
    out.push({
      studentId: r.studentId,
      focusRating: focus,
      workSummary,
      redirectionLevel: redirection,
      guideNote: guideNoteRaw || null,
    });
  }
  return out;
}

function reportError(message: string) {
  if (/already been submitted/i.test(message)) {
    return NextResponse.json({ error: "A report has already been submitted for this session." }, { status: 409 });
  }
  if (/Not authorized|not authenticated/i.test(message)) {
    return NextResponse.json({ error: "You can only report on your own assigned sessions." }, { status: 403 });
  }
  if (/completed Study Hall/i.test(message)) {
    return NextResponse.json(
      { error: "Reports can only be submitted after the Study Hall is completed." },
      { status: 400 },
    );
  }
  if (/each child/i.test(message)) {
    return NextResponse.json({ error: "A report is required for each child." }, { status: 400 });
  }
  if (/Booking not found|no assigned Guide/i.test(message)) {
    return NextResponse.json({ error: "This session can't accept a report." }, { status: 400 });
  }
  if (/focus rating|redirection|worked on|Guide note|each child/i.test(message)) {
    return NextResponse.json({ error: message }, { status: 400 });
  }
  return NextResponse.json({ error: "Unable to submit the report." }, { status: 400 });
}

/**
 * Guide submits a short post-session Study Hall report for a Study Hall they
 * were assigned to. Allowed after scheduled_end (or once already completed).
 * One-child reports use `submit_session_report`. Multi-child reports use
 * `submit_household_session_report` in one request. The RPC completes the
 * booking on the happy path — the Guide does not wait for Management.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.bookingId !== "string") {
    return NextResponse.json({ error: "A booking is required." }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Not available." }, { status: 503 });
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const household = parseChildReports(body.childReports);
  if (household && household.length > 1) {
    const { data, error } = await supabase.rpc("submit_household_session_report", {
      p_booking: body.bookingId,
      p_child_reports: household.map((c) => ({
        student_id: c.studentId,
        focus: c.focusRating,
        work_summary: c.workSummary,
        redirection: c.redirectionLevel,
        guide_note: c.guideNote,
      })),
    });
    if (error) return reportError(error.message || "");
    try {
      await notifySessionReportReady(body.bookingId, data as string);
    } catch {
      /* best-effort; report already saved */
    }
    return NextResponse.json({ id: data, status: "submitted" });
  }

  const focus = household?.[0]?.focusRating ?? (typeof body.focusRating === "string" ? body.focusRating.trim() : "");
  const workSummary =
    household?.[0]?.workSummary ?? (typeof body.workSummary === "string" ? body.workSummary.trim() : "");
  const redirection =
    household?.[0]?.redirectionLevel ?? (typeof body.redirectionLevel === "string" ? body.redirectionLevel.trim() : "");
  const guideNoteRaw =
    household?.[0]?.guideNote ?? (typeof body.guideNote === "string" ? body.guideNote.trim() : "");
  const guideNote = guideNoteRaw && guideNoteRaw.length > 0 ? guideNoteRaw : null;

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

  const { data, error } = await supabase.rpc("submit_session_report", {
    p_booking: body.bookingId,
    p_focus: focus,
    p_work_summary: workSummary,
    p_redirection: redirection,
    p_guide_note: guideNote,
  });

  if (error) return reportError(error.message || "");

  try {
    await notifySessionReportReady(body.bookingId, data as string);
  } catch {
    /* best-effort; report already saved */
  }

  return NextResponse.json({ id: data, status: "submitted" });
}
