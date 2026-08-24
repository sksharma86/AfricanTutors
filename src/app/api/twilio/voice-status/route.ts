import { NextResponse, type NextRequest } from "next/server";

import { handleTwilioVoiceStatus } from "@/lib/call-parent-service";
import { getTwilioConfig, isTwilioConfigured } from "@/lib/telephony/config";
import { validateTwilioSignature } from "@/lib/telephony/twilio-signature.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Twilio Voice StatusCallback for Call Parent (with AMD AnsweredBy).
 *
 * Programmatically registered on each outbound call as:
 *   POST {NEXT_PUBLIC_APP_URL}/api/twilio/voice-status
 * with StatusCallbackEvent=completed and MachineDetection=DetectMessageEnd.
 *
 * Authenticity: X-Twilio-Signature HMAC-SHA1 (auth token). Forged callbacks are
 * rejected. Never exposes phone numbers.
 *
 * Outcomes:
 * - CallStatus=completed + AnsweredBy=human → Parent contacted (no SMS)
 * - CallStatus=completed + machine/voicemail/fax/unknown/missing → SMS once
 * - busy|failed|no-answer|canceled|rejected → SMS once
 */
export async function POST(request: NextRequest) {
  if (!isTwilioConfigured()) {
    return NextResponse.json({ error: "Telephony not configured." }, { status: 503 });
  }

  const raw = await request.text();
  const params: Record<string, string> = {};
  new URLSearchParams(raw).forEach((value, key) => {
    params[key] = value;
  });

  const { authToken } = getTwilioConfig();
  // Signature must use the exact public URL Twilio called.
  const url = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/+$/, "") + "/api/twilio/voice-status";
  const signature = request.headers.get("x-twilio-signature");

  if (!validateTwilioSignature(authToken, url, params, signature)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  const callSid = params.CallSid || "";
  const callStatus = params.CallStatus || "";
  if (!callSid || !callStatus) {
    return NextResponse.json({ error: "Missing CallSid/CallStatus." }, { status: 400 });
  }

  const answeredBy = params.AnsweredBy || null;
  const result = await handleTwilioVoiceStatus({ callSid, callStatus, answeredBy });
  return NextResponse.json({ ok: result.ok, action: result.action });
}
