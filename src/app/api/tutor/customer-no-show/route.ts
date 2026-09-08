import { NextResponse, type NextRequest } from "next/server";

import { notifyCustomerNoShow } from "@/lib/notify";
import { shouldNotifyCustomerNoShowAfterRpc } from "@/lib/notifications/customer-no-show.mjs";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function mapError(message: string) {
  if (/Not authorized|not authenticated/i.test(message)) {
    return NextResponse.json({ error: "You can only mark customer no-show for your assigned Study Hall." }, { status: 403 });
  }
  if (/Booking not found/i.test(message)) {
    return NextResponse.json({ error: "This Study Hall was not found." }, { status: 404 });
  }
  if (/15 minutes after the scheduled start/i.test(message)) {
    return NextResponse.json(
      { error: "Wait 15 minutes after the scheduled start before marking a customer no-show." },
      { status: 400 },
    );
  }
  if (/already joined/i.test(message)) {
    return NextResponse.json({ error: "The child has already joined this Study Hall." }, { status: 409 });
  }
  if (/awaiting payment/i.test(message)) {
    return NextResponse.json({ error: "This Study Hall is still awaiting payment." }, { status: 400 });
  }
  if (/was cancelled/i.test(message)) {
    return NextResponse.json({ error: "This Study Hall was cancelled." }, { status: 400 });
  }
  if (/already completed/i.test(message)) {
    return NextResponse.json({ error: "This Study Hall is already completed." }, { status: 400 });
  }
  if (/not eligible|not scheduled/i.test(message)) {
    return NextResponse.json({ error: "This Study Hall is not eligible for a customer no-show." }, { status: 400 });
  }
  return NextResponse.json({ error: "Unable to mark customer no-show." }, { status: 400 });
}

/**
 * Assigned Guide marks a customer no-show after the T+15 wait.
 * Server/database time is authoritative. Idempotent.
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

  const { data, error } = await supabase.rpc("guide_mark_customer_no_show", { p_booking: body.bookingId });
  if (error) return mapError(error.message || "");

  // Notifications are a side effect of the committed PR6 transition.
  // Failure here must not change the JSON the Guide already earned.
  try {
    if (shouldNotifyCustomerNoShowAfterRpc({ data, error })) {
      await notifyCustomerNoShow(body.bookingId);
    }
  } catch {
    /* notifications are side effects */
  }

  return NextResponse.json(data);
}
