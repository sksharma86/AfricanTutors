import { NextResponse, type NextRequest } from "next/server";

import { notifyAdminAlert } from "@/lib/notify";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SAFE = /^[A-Za-z0-9 .,'!?()\-:]+$/;

/**
 * A tutor requests to be released from an upcoming session. This records
 * tutor-side intent only (server verifies the caller is the assigned tutor); it
 * performs NO financial restoration/refund/reassignment — admin resolves via the
 * authoritative Phase 4C operations. Admin is alerted through Phase 6.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.bookingId !== "string" || typeof body.reason !== "string" || !body.reason.trim()) {
    return NextResponse.json({ error: "A booking and a reason are required." }, { status: 400 });
  }
  const reason = body.reason.trim().slice(0, 500);

  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Not available." }, { status: 503 });
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { data, error } = await supabase.rpc("request_tutor_cancellation", { p_booking: body.bookingId, p_reason: reason });
  if (error) {
    const msg = /already open/i.test(error.message)
      ? "You already have an open cancellation request for this session."
      : /Only upcoming|Not authorized|not found/i.test(error.message)
        ? "This session can't be cancelled."
        : "Unable to submit your request.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  // Alert admin (best-effort, idempotent per request id).
  void notifyAdminAlert(`tutor-cancellation:${data}`, {
    title: "Tutor cancellation request",
    summary: "A tutor has requested to be released from an upcoming session and needs reassignment or release.",
    lines: [`Booking: ${body.bookingId}`, SAFE.test(reason) ? `Reason: ${reason}` : "Reason: (provided)"],
  });

  return NextResponse.json({ id: data, status: "open" });
}
