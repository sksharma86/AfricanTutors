import { NextResponse, type NextRequest } from "next/server";

import { classifyInboundSmsKeyword, inboundFromE164 } from "@/lib/notifications/sms-opt-out.mjs";
import { getServiceSupabase } from "@/lib/supabase/service";
import { getTwilioConfig, isTwilioConfigured } from "@/lib/telephony/config";
import { validateTwilioSignature } from "@/lib/telephony/twilio-signature.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMPTY_TWIML = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';

function twiml() {
  return new NextResponse(EMPTY_TWIML, {
    status: 200,
    headers: { "Content-Type": "text/xml; charset=utf-8" },
  });
}

/**
 * Twilio inbound SMS webhook for transactional STOP/START.
 *
 * Configure in Twilio Console (do not change production from this branch):
 *   POST {NEXT_PUBLIC_APP_URL}/api/twilio/inbound-sms
 *
 * If Twilio Advanced Opt-Out is enabled on a Messaging Service, Twilio may
 * already auto-reply and suppress further sends. We still persist our own
 * preference so app eligibility fails closed. Empty TwiML avoids a second reply.
 *
 * In-app Account re-opt-in updates our DB only. If the parent previously
 * texted STOP, they must also reply START to this number before Twilio will
 * deliver again.
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
  const url = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/+$/, "") + "/api/twilio/inbound-sms";
  const signature = request.headers.get("x-twilio-signature");

  if (!validateTwilioSignature(authToken, url, params, signature)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  const kind = classifyInboundSmsKeyword(params.Body, params.OptOutType);
  const phone = inboundFromE164(params.From);

  if ((kind === "opt_out" || kind === "opt_in") && phone) {
    try {
      await getServiceSupabase().rpc("apply_inbound_sms_keyword", {
        p_phone: phone,
        p_kind: kind,
      });
    } catch {
      /* persist best-effort; always ack Twilio */
    }
  }

  return twiml();
}
