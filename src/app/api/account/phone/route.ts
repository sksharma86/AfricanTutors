import { NextResponse, type NextRequest } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Parent updates their Call Parent contact number (E.164). Guides never call this. */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const phone =
    body && (body.phone === null || typeof body.phone === "string")
      ? body.phone === null
        ? ""
        : String(body.phone).trim()
      : null;

  if (phone === null) {
    return NextResponse.json({ error: "Phone is required." }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Not available." }, { status: 503 });
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { data, error } = await supabase.rpc("set_my_phone", { p_phone: phone || null });
  if (error) {
    const msg = error.message || "";
    if (/E\.164|Not authorized|Not authenticated/i.test(msg)) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    return NextResponse.json({ error: "Unable to save phone." }, { status: 400 });
  }

  return NextResponse.json({ phone: data });
}
