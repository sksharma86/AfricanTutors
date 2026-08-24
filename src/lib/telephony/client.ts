import "server-only";

import { getTwilioConfig, isTwilioConfigured } from "@/lib/telephony/config";

/**
 * Telephony provider abstraction (Twilio Voice + SMS).
 * Secrets stay server-side. Never throws — returns structured results so Call
 * Parent can fall back to SMS or report failure without claiming success.
 *
 * Designed so a later centralized notification system can reuse this module.
 */

export interface CallResult {
  status: "queued" | "failed" | "skipped";
  sid?: string | null;
  error?: string | null;
}

export interface SmsResult {
  status: "sent" | "failed" | "skipped";
  sid?: string | null;
  error?: string | null;
}

function basicAuthHeader(accountSid: string, authToken: string): string {
  const raw = `${accountSid}:${authToken}`;
  return `Basic ${Buffer.from(raw).toString("base64")}`;
}

/**
 * Place an outbound TTS call. Uses Twilio's Twiml request body (no public TwiML
 * URL required for the spoken message). Destination must already be E.164.
 */
export async function placeParentAttentionCall(opts: {
  toE164: string;
  message: string;
}): Promise<CallResult> {
  if (!opts.toE164) return { status: "skipped", error: "no destination" };
  if (!isTwilioConfigured()) {
    return { status: "skipped", error: "telephony not configured" };
  }

  const { accountSid, authToken, phoneNumber } = getTwilioConfig();
  const twiml = `<Response><Say voice="Polly.Joanna">${escapeXml(opts.message)}</Say></Response>`;
  const body = new URLSearchParams({
    To: opts.toE164,
    From: phoneNumber,
    Twiml: twiml,
  });

  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`, {
      method: "POST",
      headers: {
        Authorization: basicAuthHeader(accountSid, authToken),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
    const data = (await res.json().catch(() => ({}))) as { sid?: string; message?: string; status?: string };
    if (!res.ok) {
      return {
        status: "failed",
        error: data.message || `twilio call ${res.status}`,
      };
    }
    return { status: "queued", sid: data.sid ?? null };
  } catch (e) {
    return { status: "failed", error: e instanceof Error ? e.message : "call error" };
  }
}

/** SMS fallback when the voice call cannot be placed. */
export async function sendParentAttentionSms(opts: {
  toE164: string;
  body: string;
}): Promise<SmsResult> {
  if (!opts.toE164) return { status: "skipped", error: "no destination" };
  if (!isTwilioConfigured()) {
    return { status: "skipped", error: "telephony not configured" };
  }

  const { accountSid, authToken, phoneNumber } = getTwilioConfig();
  const form = new URLSearchParams({
    To: opts.toE164,
    From: phoneNumber,
    Body: opts.body,
  });

  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: basicAuthHeader(accountSid, authToken),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form,
    });
    const data = (await res.json().catch(() => ({}))) as { sid?: string; message?: string };
    if (!res.ok) {
      return {
        status: "failed",
        error: data.message || `twilio sms ${res.status}`,
      };
    }
    return { status: "sent", sid: data.sid ?? null };
  } catch (e) {
    return { status: "failed", error: e instanceof Error ? e.message : "sms error" };
  }
}

function escapeXml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!,
  );
}
