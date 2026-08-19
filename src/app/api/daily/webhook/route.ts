import { createHmac, timingSafeEqual } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";

import { DAILY_WEBHOOK_SECRET } from "@/lib/daily/config";
import { getServiceSupabase } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Room name is `at-<uuid-without-hyphens>`; reverse to the booking uuid.
function roomToBooking(room: string | undefined | null): string | null {
  if (!room || !room.startsWith("at-")) return null;
  const hex = room.slice(3);
  if (!/^[0-9a-f]{32}$/i.test(hex)) return null;
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function verify(rawBody: string, timestamp: string | null, signature: string | null): boolean {
  if (!DAILY_WEBHOOK_SECRET || !timestamp || !signature) return false;
  try {
    const mac = createHmac("sha256", Buffer.from(DAILY_WEBHOOK_SECRET, "base64"));
    mac.update(`${timestamp}.${rawBody}`);
    const expected = mac.digest();
    const provided = Buffer.from(signature, "base64");
    return expected.length === provided.length && timingSafeEqual(expected, provided);
  } catch {
    return false;
  }
}

/**
 * Minimal, signature-verified Daily webhook foundation. Updates session presence
 * (join/left) only. Disabled (503) unless DAILY_WEBHOOK_SECRET is set. Never
 * touches booking/payment/earning state. Unknown events are safe no-ops.
 */
export async function POST(request: NextRequest) {
  if (!DAILY_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Webhook not configured." }, { status: 503 });
  }
  const raw = await request.text();

  // Daily sends a one-time verification challenge when registering the endpoint.
  let parsed: { type?: string; test?: string; payload?: Record<string, unknown> } | null = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Bad payload." }, { status: 400 });
  }
  if (parsed?.test) return NextResponse.json({ test: parsed.test });

  if (!verify(raw, request.headers.get("x-webhook-timestamp"), request.headers.get("x-webhook-signature"))) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  const type = parsed?.type;
  const payload = (parsed?.payload ?? {}) as Record<string, unknown>;
  const event = type === "participant.joined" ? "join" : type === "participant.left" ? "leave" : null;
  if (!event) return NextResponse.json({ received: true });

  const bookingId = roomToBooking((payload.room ?? payload.room_name) as string | undefined);
  const role = payload.user_id === "student" || payload.user_id === "tutor" ? (payload.user_id as string) : null;
  if (bookingId && role) {
    try {
      await getServiceSupabase().rpc("record_session_presence", { p_booking: bookingId, p_role: role, p_event: event });
    } catch {
      // best-effort
    }
  }
  return NextResponse.json({ received: true });
}
