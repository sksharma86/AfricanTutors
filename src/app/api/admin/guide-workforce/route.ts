import { NextResponse, type NextRequest } from "next/server";

import { adminApiContext } from "@/lib/admin-service";
import { guideWorkforceLabel } from "@/lib/guide-workforce.mjs";
import { notifyAdminAlert, notifyReassignment } from "@/lib/notify";
import { getServiceSupabase } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACTIONS = new Set(["reject", "suspend", "reactivate"]);

type FutureBooking = {
  id: string;
  public_reference: string | null;
  student_first_name: string | null;
  scheduled_start: string | null;
  status: string;
};

async function loadFutureAssignments(tutorId: string): Promise<FutureBooking[]> {
  const service = getServiceSupabase();
  const { data, error } = await service
    .from("bookings")
    .select("id, public_reference, student_first_name, student_first_names, scheduled_start, status")
    .eq("tutor_id", tutorId)
    .in("status", ["pending", "confirmed"])
    .not("scheduled_start", "is", null)
    .gt("scheduled_start", new Date().toISOString())
    .order("scheduled_start", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as FutureBooking[];
}

/** Admin preview of a Guide's workforce status and future assigned Study Halls. */
export async function GET(request: NextRequest) {
  try {
    await adminApiContext();
  } catch (e) {
    const m = e instanceof Error ? e.message : "";
    return NextResponse.json({ error: m }, { status: /authenticated/i.test(m) ? 401 : 403 });
  }

  const profileId = request.nextUrl.searchParams.get("profileId") ?? "";
  if (!profileId) return NextResponse.json({ error: "profileId is required." }, { status: 400 });

  const service = getServiceSupabase();
  const { data: tp, error } = await service
    .from("tutor_profiles")
    .select("status, approved_at, profiles!tutor_profiles_profile_id_fkey(display_name)")
    .eq("profile_id", profileId)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!tp) return NextResponse.json({ error: "Guide profile not found." }, { status: 404 });

  const future = await loadFutureAssignments(profileId);
  return NextResponse.json({
    profileId,
    status: tp.status,
    approvedAt: tp.approved_at,
    label: guideWorkforceLabel(tp.status, tp.approved_at),
    displayName: (() => {
      const profiles = tp.profiles as unknown as { display_name: string | null } | { display_name: string | null }[] | null;
      if (Array.isArray(profiles)) return profiles[0]?.display_name ?? null;
      return profiles?.display_name ?? null;
    })(),
    futureAssignments: future,
  });
}

/**
 * Admin-only workforce transitions:
 *  reject     — pending applicant → derived rejected (status=suspended, no approved_at)
 *  suspend    — approved Guide → suspended, then try existing auto-reassign on futures
 *  reactivate — suspended Guide → approve_tutor (existing reactivation path)
 */
export async function POST(request: NextRequest) {
  let ctx;
  try {
    ctx = await adminApiContext();
  } catch (e) {
    const m = e instanceof Error ? e.message : "";
    return NextResponse.json({ error: m }, { status: /authenticated/i.test(m) ? 401 : 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body.profileId !== "string" || !ACTIONS.has(body.action)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const profileId = body.profileId;
  const { supabase } = ctx;

  if (body.action === "reject") {
    const { error } = await supabase.rpc("reject_tutor", { target: profileId });
    if (error) return NextResponse.json({ error: error.message.replace(/^.*:\s*/, "") }, { status: 400 });
    return NextResponse.json({ action: "reject", status: "rejected" });
  }

  if (body.action === "reactivate") {
    const { error } = await supabase.rpc("approve_tutor", { target: profileId });
    if (error) return NextResponse.json({ error: error.message.replace(/^.*:\s*/, "") }, { status: 400 });
    return NextResponse.json({ action: "reactivate", status: "active" });
  }

  const futureBefore = await loadFutureAssignments(profileId);
  const { error: suspendErr } = await supabase.rpc("suspend_tutor", { target: profileId });
  if (suspendErr) {
    return NextResponse.json({ error: suspendErr.message.replace(/^.*:\s*/, "") }, { status: 400 });
  }

  type AutoResult = { status?: string; from_tutor?: string; to_tutor?: string; reason?: string };
  const reassigned: { bookingId: string; toTutorId: string | null }[] = [];
  const needsAttention: { bookingId: string; reason: string; publicReference: string | null; scheduledStart: string | null }[] =
    [];

  const service = getServiceSupabase();
  for (const booking of futureBefore) {
    let auto: AutoResult | null = null;
    try {
      const { data, error: autoErr } = await service.rpc("try_auto_reassign_booking", { p_booking: booking.id });
      if (autoErr) {
        console.error("try_auto_reassign_booking failed", autoErr.message);
        auto = { status: "needs_admin", reason: autoErr.message };
      } else {
        auto = (data ?? null) as AutoResult | null;
      }
    } catch (e) {
      console.error("try_auto_reassign_booking exception", e);
      auto = { status: "needs_admin", reason: "exception" };
    }

    if (auto?.status === "reassigned") {
      reassigned.push({ bookingId: booking.id, toTutorId: auto.to_tutor ?? null });
      try {
        await notifyReassignment(booking.id, {
          reassigned: true,
          removedTutorId: auto.from_tutor ?? profileId,
        });
      } catch {
        /* best-effort */
      }
    } else {
      needsAttention.push({
        bookingId: booking.id,
        reason: auto?.reason ?? "needs_admin",
        publicReference: booking.public_reference,
        scheduledStart: booking.scheduled_start,
      });
      try {
        await notifyAdminAlert(`guide-coverage-failed:${booking.id}`, {
          title: "Guide coverage failed — needs reassignment",
          summary:
            "A Guide was suspended and no eligible replacement was continuously available for the full Study Hall. Booking is unchanged for the parent; manager action required.",
          lines: [
            `Booking: ${booking.id}`,
            `Guide: ${profileId}`,
            `Auto result: ${auto?.reason ?? "needs_admin"}`,
          ],
        });
      } catch {
        /* best-effort */
      }
    }
  }

  return NextResponse.json({
    action: "suspend",
    status: "suspended",
    reassigned,
    needsAttention,
    futureCount: futureBefore.length,
  });
}
