import { createHmac, timingSafeEqual } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";

import { DAILY_WEBHOOK_SECRET } from "@/lib/daily/config";
import { roomToBooking } from "@/lib/daily/room-mapping.mjs";
import { notifyRecordingFailure } from "@/lib/notify";
import { getServiceSupabase } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  const supabase = getServiceSupabase();

  // --- Presence (Phase 5A) ---
  if (type === "participant.joined" || type === "participant.left") {
    const bookingId = roomToBooking((payload.room ?? payload.room_name) as string | undefined);
    const role = payload.user_id === "student" || payload.user_id === "tutor" ? (payload.user_id as string) : null;
    if (bookingId && role) {
      try {
        await supabase.rpc("record_session_presence", { p_booking: bookingId, p_role: role, p_event: type === "participant.joined" ? "join" : "leave" });
      } catch {
        /* best-effort */
      }
    }
    return NextResponse.json({ received: true });
  }

  // --- Recording lifecycle (Phase 5B) ---
  // recording.started has no room_name (cannot be authoritatively associated) →
  // safe no-op. recording.ready-to-download and recording.error carry room_name,
  // which we reverse to the booking (never client-supplied). Idempotent per Daily
  // recording id / instance id in record_recording_event.
  if (type === "recording.ready-to-download" || type === "recording.error") {
    const bookingId = roomToBooking(payload.room_name as string | undefined);
    if (!bookingId) return NextResponse.json({ received: true }); // unmappable → ignore safely
    const args =
      type === "recording.ready-to-download"
        ? {
            p_booking: bookingId,
            p_status: "completed",
            p_recording_id: (payload.recording_id as string) ?? null,
            p_instance_id: null,
            p_room_name: payload.room_name as string,
            p_started_at: payload.start_ts ? new Date((payload.start_ts as number) * 1000).toISOString() : null,
            p_completed_at: new Date().toISOString(),
            p_duration: typeof payload.duration === "number" ? payload.duration : null,
            p_max_participants: typeof payload.max_participants === "number" ? payload.max_participants : null,
            p_storage_key: (payload.s3_key as string) ?? null,
            p_share_token: (payload.share_token as string) ?? null,
            p_error: null,
          }
        : {
            p_booking: bookingId,
            p_status: "failed",
            p_recording_id: null,
            p_instance_id: (payload.instance_id as string) ?? null,
            p_room_name: payload.room_name as string,
            p_started_at: null,
            p_completed_at: null,
            p_duration: null,
            p_max_participants: null,
            p_storage_key: null,
            p_share_token: null,
            p_error: (payload.error_msg as string) ?? "recording error",
          };
    try {
      await supabase.rpc("record_recording_event", args);
      if (type === "recording.error") {
        try {
          await notifyRecordingFailure(bookingId, (payload.error_msg as string) ?? "recording error");
        } catch {
          /* best-effort alert */
        }
      }
    } catch {
      /* best-effort; recording is evidence only and never blocks anything */
    }
    return NextResponse.json({ received: true });
  }

  // Any other event (incl. recording.started) → safe no-op.
  return NextResponse.json({ received: true });
}
