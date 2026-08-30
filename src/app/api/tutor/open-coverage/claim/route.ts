import { NextResponse, type NextRequest } from "next/server";

import { claimResultMessage, mapClaimRpcReason } from "@/lib/open-coverage.mjs";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Atomic first-claim for an emergency open-coverage offer.
 * Accept = assign + confirm attendance. Never exposes who won.
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

  const { data, error } = await supabase.rpc("claim_open_coverage", { p_booking: body.bookingId });
  if (error) {
    return NextResponse.json({ error: claimResultMessage("already_covered"), reason: "already_covered" }, { status: 409 });
  }

  const payload = (data ?? {}) as { ok?: boolean; reason?: string; alreadyConfirmed?: boolean };
  if (payload.ok) {
    return NextResponse.json({
      ok: true,
      reason: "won",
      alreadyConfirmed: Boolean(payload.alreadyConfirmed),
      message: claimResultMessage("won"),
    });
  }

  const reason = mapClaimRpcReason(payload.reason);
  return NextResponse.json(
    { ok: false, reason, message: claimResultMessage(reason) },
    { status: reason === "already_covered" ? 409 : 400 },
  );
}
