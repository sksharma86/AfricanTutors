import { NextResponse, type NextRequest } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Parent transactional SMS preference (Account toggle).
 * Independent of set_my_phone — editing a number does not opt in.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.optIn !== "boolean") {
    return NextResponse.json({ error: "optIn is required." }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Not available." }, { status: 503 });
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { data, error } = await supabase.rpc("set_my_sms_transactional_preference", {
    p_opt_in: body.optIn,
  });
  if (error) {
    const msg = error.message || "";
    if (/does not exist|sms_transactional/i.test(msg)) {
      return NextResponse.json({ error: "Text alerts are not available yet." }, { status: 503 });
    }
    if (/Not authorized|Not authenticated/i.test(msg)) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    return NextResponse.json({ error: "Unable to save text-alert preference." }, { status: 400 });
  }

  return NextResponse.json({
    optIn: data?.opt_in === true,
    optInAt: data?.opt_in_at ?? null,
    optOutAt: data?.opt_out_at ?? null,
  });
}
