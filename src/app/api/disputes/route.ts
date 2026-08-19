import { NextResponse, type NextRequest } from "next/server";

import { sendDisputeReceived } from "@/lib/email";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CATEGORIES = new Set(["unprepared", "quality", "behavior", "no_value", "other"]);

/** Customer submits a dispute for their own eligible booking. */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.bookingId !== "string" || typeof body.category !== "string") {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const category = CATEGORIES.has(body.category) ? body.category : "other";
  const complaint = typeof body.complaint === "string" ? body.complaint.slice(0, 2000) : null;

  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Not available." }, { status: 503 });
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { data, error } = await supabase.rpc("create_dispute", { p_booking: body.bookingId, p_category: category, p_complaint: complaint });
  if (error) {
    const msg = /already an open dispute/i.test(error.message)
      ? "You already have an open concern for this session."
      : /not eligible|not authorized|not found/i.test(error.message)
        ? "This session isn't eligible for a concern."
        : "Unable to submit your concern.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  const { data: b } = await supabase.from("bookings").select("public_reference").eq("id", body.bookingId).maybeSingle();
  void sendDisputeReceived({ to: userRes.user.email ?? "", reference: b?.public_reference });
  return NextResponse.json({ id: data, status: "open" });
}
