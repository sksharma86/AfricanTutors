/**
 * Twilio request signature validation (X-Twilio-Signature) + Call Parent
 * status / AMD classification helpers.
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

/**
 * Terminal Twilio CallStatus when the call was connected then ended.
 * NOT sufficient for "Parent contacted" — may be human, voicemail, or IVR.
 * Requires AMD AnsweredBy=human for confirmed human contact.
 */
export const TWILIO_CALL_ANSWERED_STATUS = "completed";

/** Intermediate statuses — not success (queued ≠ answered). */
export const TWILIO_CALL_INTERMEDIATE_STATUSES = Object.freeze([
  "queued",
  "ringing",
  "in-progress",
]);

/**
 * DetectMessageEnd machine / fax AnsweredBy values (plus Enable's machine_start).
 * Voice message may still be delivered; SMS fallback is still required.
 */
export const TWILIO_AMD_MACHINE_VALUES = Object.freeze([
  "machine_start",
  "machine_end_beep",
  "machine_end_silence",
  "machine_end_other",
  "fax",
]);

/**
 * @param {string | null | undefined} callStatus
 * @returns {'completed'|'failed'|'intermediate'|'unknown'}
 */
export function classifyTwilioCallStatus(callStatus) {
  const s = String(callStatus || "").toLowerCase();
  if (s === TWILIO_CALL_ANSWERED_STATUS) return "completed";
  if (TWILIO_CALL_FAILURE_STATUSES.includes(s)) return "failed";
  if (TWILIO_CALL_INTERMEDIATE_STATUSES.includes(s)) return "intermediate";
  return "unknown";
}

/**
 * Classify Twilio AMD AnsweredBy.
 * Missing / unknown → safer SMS path (not confirmed human contact).
 *
 * @param {string | null | undefined} answeredBy
 * @returns {'human'|'machine'|'unknown'}
 */
export function classifyTwilioAnsweredBy(answeredBy) {
  const s = String(answeredBy || "")
    .trim()
    .toLowerCase();
  if (s === "human") return "human";
  if (TWILIO_AMD_MACHINE_VALUES.includes(s)) return "machine";
  return "unknown";
}

/**
 * Whether this CallStatus + AnsweredBy pair is confirmed human parent contact.
 * completed alone is never enough.
 *
 * @param {string | null | undefined} callStatus
 * @param {string | null | undefined} answeredBy
 */
export function isConfirmedHumanParentContact(callStatus, answeredBy) {
  return (
    classifyTwilioCallStatus(callStatus) === "completed" &&
    classifyTwilioAnsweredBy(answeredBy) === "human"
  );
}
