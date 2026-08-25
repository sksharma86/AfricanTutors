import { NextResponse, type NextRequest } from "next/server";

import { adminApiContext } from "@/lib/admin-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Eligible Guides for manual reassignment of a booking.
 * Same rules as automatic reassignment: approved, continuously available for
 * the entire session, no overlap, not the current Guide. Subjects ignored.
 */
export async function GET(request: NextRequest) {
  let ctx;
  try {
    ctx = await adminApiContext();
  } catch (e) {
    const m = e instanceof Error ? e.message : "";
    return NextResponse.json({ error: m }, { status: /authenticated/i.test(m) ? 401 : 403 });
  }

  const bookingId = request.nextUrl.searchParams.get("bookingId");
  if (!bookingId) {
    return NextResponse.json({ error: "bookingId required." }, { status: 400 });
  }

  const { data, error } = await ctx.supabase.rpc("list_reassignment_candidates", {
    p_booking: bookingId,
  });
  if (error) {
    return NextResponse.json({ error: error.message.replace(/^.*:\s*/, "") }, { status: 400 });
  }

  return NextResponse.json({
    candidates: (data ?? []).map(
      (row: { candidate_tutor_id?: string; tutor_id?: string; display_name: string | null; upcoming_load: number }) => ({
        profile_id: row.candidate_tutor_id ?? row.tutor_id,
        display_name: row.display_name,
        upcoming_load: Number(row.upcoming_load ?? 0),
      }),
    ),
  });
}
