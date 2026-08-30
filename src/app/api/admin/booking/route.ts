import { NextResponse, type NextRequest } from "next/server";

import { adminApiContext } from "@/lib/admin-service";
import { COVERAGE_CANCEL_REASON, isCoverageCancellationReason } from "@/lib/guide-attendance.mjs";
import { notifyCoverageCancellation, notifyCurrentAttendanceRequest, notifyReassignment } from "@/lib/notify";
import { getServiceSupabase } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACTIONS = new Set(["no_show", "complete", "release", "reassign"]);

/** Admin booking lifecycle operations with server-side transition validation. */
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
  if (!body || typeof body.bookingId !== "string" || !ACTIONS.has(body.action)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const reason = typeof body.reason === "string" ? body.reason : null;

  let res;
  if (body.action === "no_show") {
    res = await supabase.rpc("admin_no_show", { p_booking: body.bookingId });
  } else if (body.action === "complete") {
    res = await supabase.rpc("admin_complete_booking", { p_booking: body.bookingId });
  } else if (body.action === "release") {
    const comp = Number.isInteger(body.compCreditCents) && body.compCreditCents > 0 ? body.compCreditCents : 0;
    res = await supabase.rpc("admin_release_booking", { p_booking: body.bookingId, p_reason: reason ?? "booking released", p_comp_credit_cents: comp });
  } else {
    if (typeof body.newTutorId !== "string") return NextResponse.json({ error: "newTutorId required." }, { status: 400 });
    res = await supabase.rpc("admin_reassign_tutor", { p_booking: body.bookingId, p_new_tutor: body.newTutorId, p_reason: reason ?? "reassignment" });
  }
  if (res.error) return NextResponse.json({ error: res.error.message.replace(/^.*:\s*/, "") }, { status: 400 });

  // Resolve any open tutor-cancellation request now that admin has acted.
  if (body.action === "reassign" || body.action === "release") {
    try {
      await getServiceSupabase().rpc("resolve_tutor_cancellation_by_booking", { p_booking: body.bookingId });
    } catch {
      /* best-effort */
    }
  }

  // Customer + affected-tutor notifications for tutor-side outcomes (best-effort, idempotent).
  if (body.action === "reassign") {
    const removedTutorId = (res.data as { from_tutor?: string } | null)?.from_tutor ?? null;
    try {
      await notifyReassignment(body.bookingId, { reassigned: true, removedTutorId });
      await notifyCurrentAttendanceRequest(body.bookingId);
    } catch {
      /* best-effort */
    }
  } else if (body.action === "release") {
    try {
      if (isCoverageCancellationReason(reason) || reason === COVERAGE_CANCEL_REASON) {
        const released = (res.data ?? {}) as {
          restored_minutes?: number;
          restored_credit_cents?: number;
          restored?: number;
        };
        const { data: booking } = await getServiceSupabase()
          .from("bookings")
          .select("is_free_trial")
          .eq("id", body.bookingId)
          .maybeSingle();
        await notifyCoverageCancellation(body.bookingId, {
          isFreeTrial: Boolean(booking?.is_free_trial),
          restoredMinutes: released.restored_minutes ?? null,
          restoredCreditCents: released.restored_credit_cents ?? null,
          compCreditCents: body.compCreditCents ?? 0,
        });
      } else {
        await notifyReassignment(body.bookingId, { reassigned: false, compCreditCents: body.compCreditCents ?? 0 });
      }
    } catch {
      /* best-effort */
    }
  }
  return NextResponse.json(res.data);
}
