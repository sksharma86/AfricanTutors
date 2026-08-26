import { NextResponse, type NextRequest } from "next/server";

import { notifyCancellation } from "@/lib/notify";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Customer-initiated cancellation. The server (customer_cancel_booking) decides
 * the 24-hour outcome authoritatively; the client cannot claim credit eligibility.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.bookingId !== "string") {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Not available." }, { status: 503 });
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { data, error } = await supabase.rpc("customer_cancel_booking", { p_booking: body.bookingId });
  if (error) return NextResponse.json({ error: "Unable to cancel this booking." }, { status: 400 });

  const result = data as { status: string; early?: boolean; restored_minutes?: number; restored_credit_cents?: number };
  if (result.status === "cancelled") {
    try {
      await notifyCancellation(body.bookingId, {
        early: Boolean(result.early),
        restoredMinutes: result.restored_minutes ?? null,
        restoredCreditCents: result.restored_credit_cents ?? null,
      });
    } catch {
      /* best-effort */
    }
  }
  return NextResponse.json(result);
}
