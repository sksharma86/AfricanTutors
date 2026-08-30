import { NextResponse, type NextRequest } from "next/server";

import { notifyAdminAlert, notifyCurrentAttendanceRequest, notifyReassignment } from "@/lib/notify";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getServiceSupabase } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SAFE = /^[A-Za-z0-9 .,'!?()\-:]+$/;

/**
 * Guide requests to be released from an upcoming Study Hall.
 *
 * Records the cancellation request, then attempts automatic reassignment to
 * another approved Guide who is continuously available for the entire booked
 * interval (no subject matching). Success notifies the replacement Guide and
 * stays silent to the parent (PR8). Failure leaves the request open and alerts
 * admin for coverage — no invented cancel/refund policy.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.bookingId !== "string" || typeof body.reason !== "string" || !body.reason.trim()) {
    return NextResponse.json({ error: "A booking and a reason are required." }, { status: 400 });
  }
  const reason = body.reason.trim().slice(0, 500);
  const bookingId = body.bookingId;

  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Not available." }, { status: 503 });
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { data: requestId, error } = await supabase.rpc("request_tutor_cancellation", {
    p_booking: bookingId,
    p_reason: reason,
  });
  if (error) {
    const msg = /already open/i.test(error.message)
      ? "You already have an open cancellation request for this session."
      : /Only upcoming|Not authorized|not found/i.test(error.message)
        ? "This session can't be cancelled."
        : "Unable to submit your request.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  // Auto-reassign via service role (is_financial_actor when auth.uid() is null).
  type AutoResult = { status?: string; from_tutor?: string; to_tutor?: string; reason?: string };
  let auto: AutoResult | null = null;
  try {
    const service = getServiceSupabase();
    const { data, error: autoErr } = await service.rpc("try_auto_reassign_booking", { p_booking: bookingId });
    if (autoErr) {
      console.error("try_auto_reassign_booking failed", autoErr.message);
    } else {
      auto = (data ?? null) as AutoResult | null;
    }
  } catch (e) {
    console.error("try_auto_reassign_booking exception", e);
  }

  if (auto?.status === "reassigned") {
    try {
      await notifyReassignment(bookingId, {
        reassigned: true,
        removedTutorId: auto.from_tutor ?? userRes.user.id,
      });
      await notifyCurrentAttendanceRequest(bookingId);
    } catch {
      /* best-effort */
    }
    return NextResponse.json({
      id: requestId,
      status: "reassigned",
      fromTutorId: auto.from_tutor ?? null,
      toTutorId: auto.to_tutor ?? null,
    });
  }

  // Coverage could not be restored — keep request open; alert manager.
  try {
    await notifyAdminAlert(`guide-coverage-failed:${bookingId}`, {
      title: "Guide coverage failed — needs reassignment",
      summary:
        "A Guide became unavailable and no eligible replacement was continuously available for the full Study Hall. Booking is unchanged for the parent; manager action required.",
      lines: [
        `Booking: ${bookingId}`,
        SAFE.test(reason) ? `Reason: ${reason}` : "Reason: (provided)",
        `Auto result: ${auto?.reason ?? "needs_admin"}`,
      ],
    });
  } catch {
    /* best-effort */
  }

  return NextResponse.json({
    id: requestId,
    status: "needs_admin",
    reason: auto?.reason ?? "no_eligible_guide",
  });
}
