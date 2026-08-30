import { NextResponse, type NextRequest } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Assigned Guide confirms they will attend. Server is authoritative.
 * Idempotent. Does not join the room.
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

  const { data, error } = await supabase.rpc("confirm_guide_attendance_block", { p_booking: body.bookingId });
  if (error) {
    const msg = error.message.replace(/^.*:\s*/, "");
    if (/Not authorized|not eligible|deadline|not open|not found/i.test(msg)) {
      return NextResponse.json({ error: msg }, { status: /authorized/i.test(msg) ? 403 : 400 });
    }
    return NextResponse.json({ error: "Unable to confirm attendance." }, { status: 400 });
  }
  return NextResponse.json(data);
}
