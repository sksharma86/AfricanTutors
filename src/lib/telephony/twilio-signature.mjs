/**
 * Twilio request signature validation (X-Twilio-Signature).
 * Pure crypto — no secrets logged. Used by the voice-status webhook.
 *
 * Spec: HMAC-SHA1(authToken, fullUrl + sorted(key+value for each POST param))
 * then Base64, compared with timing-safe equality.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * @param {string} authToken
 * @param {string} url Full absolute callback URL Twilio POSTed to (must match exactly)
 * @param {Record<string, string>} params Application/x-www-form-urlencoded fields
 * @param {string | null | undefined} signatureHeader X-Twilio-Signature value
 */
export function validateTwilioSignature(authToken, url, params, signatureHeader) {
  if (!authToken || !url || !signatureHeader) return false;
  try {
    const keys = Object.keys(params).sort();
    let data = url;
    for (const k of keys) {
      data += k + (params[k] ?? "");
    }
    const expected = createHmac("sha1", authToken).update(Buffer.from(data, "utf8")).digest("base64");
    const a = Buffer.from(expected);
    const b = Buffer.from(signatureHeader);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** Terminal Twilio CallStatus values that mean the parent did NOT successfully answer. */
export const TWILIO_CALL_FAILURE_STATUSES = Object.freeze([
  "busy",
  "failed",
  "no-answer",
  "canceled",
  // Rare / legacy; treat like canceled if Twilio ever emits it.
  "rejected",
]);

/** Terminal Twilio CallStatus that means the call was answered then ended. */
export const TWILIO_CALL_ANSWERED_STATUS = "completed";

/** Intermediate statuses — not success (queued ≠ answered). */
export const TWILIO_CALL_INTERMEDIATE_STATUSES = Object.freeze([
  "queued",
  "ringing",
  "in-progress",
]);

/**
 * @param {string | null | undefined} callStatus
 * @returns {'answered'|'failed'|'intermediate'|'unknown'}
 */
export function classifyTwilioCallStatus(callStatus) {
  const s = String(callStatus || "").toLowerCase();
  if (s === TWILIO_CALL_ANSWERED_STATUS) return "answered";
  if (TWILIO_CALL_FAILURE_STATUSES.includes(s)) return "failed";
  if (TWILIO_CALL_INTERMEDIATE_STATUSES.includes(s)) return "intermediate";
  return "unknown";
}
