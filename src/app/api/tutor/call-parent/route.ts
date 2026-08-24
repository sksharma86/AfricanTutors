import { NextResponse, type NextRequest } from "next/server";

import { fulfillParentEscalation } from "@/lib/call-parent-service";
import {
  ESCALATION_NOTE_MAX,
  isEscalationReason,
} from "@/lib/call-parent.mjs";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Guide Call Parent — creates an escalation audit row (DEFINER RPC), then
 * places an automated Twilio call (SMS fallback) server-side. The response
 * never includes the parent's phone number or Twilio secrets.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.bookingId !== "string") {
    return NextResponse.json({ error: "A booking is required." }, { status: 400 });
  }

  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  const noteRaw = typeof body.note === "string" ? body.note.trim() : "";
  const note = noteRaw.length > 0 ? noteRaw.slice(0, ESCALATION_NOTE_MAX) : null;

  if (!isEscalationReason(reason)) {
    return NextResponse.json({ error: "Choose a reason." }, { status: 400 });
  }
  if (noteRaw.length > ESCALATION_NOTE_MAX) {
    return NextResponse.json(
      { error: `Note must be at most ${ESCALATION_NOTE_MAX} characters.` },
      { status: 400 },
    );
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Not available." }, { status: 503 });
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { data: escalationId, error } = await supabase.rpc("request_parent_escalation", {
    p_booking: body.bookingId,
    p_reason: reason,
    p_note: note,
  });

  if (error) {
    const msg = error.message || "";
    if (/wait before requesting/i.test(msg)) {
      return NextResponse.json(
        { error: "Please wait a few minutes before requesting parent attention again." },
        { status: 429 },
      );
    }
    if (/Not authorized|not authenticated/i.test(msg)) {
      return NextResponse.json({ error: "You can only Call Parent for your own assigned Study Hall." }, { status: 403 });
    }
    if (/active confirmed|active Study Hall window|not scheduled/i.test(msg)) {
      return NextResponse.json(
        { error: "Call Parent is only available during an active Study Hall." },
        { status: 400 },
      );
    }
    if (/Booking not found|no assigned Guide|valid reason|Note must/i.test(msg)) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    return NextResponse.json({ error: "Unable to request parent attention." }, { status: 400 });
  }

  const result = await fulfillParentEscalation(escalationId as string);

  // Never include phone, Twilio SIDs, or secrets in the Guide-facing payload.
  return NextResponse.json({
    id: result.escalationId,
    status: result.guideStatus,
    message: result.message,
  });
}
