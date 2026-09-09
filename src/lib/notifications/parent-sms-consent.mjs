/**
 * PR7F — authoritative parent transactional SMS eligibility.
 *
 * Consent is never inferred from phone_e164. Email is independent.
 * Call Parent *voice* does not use this predicate.
 */

export const PARENT_PHONE_E164 = /^\+[1-9][0-9]{7,14}$/;

export const PARENT_SMS_PHONE_PURPOSE =
  "We use your number to reach you about your Study Halls, including if you're needed during a session. We don't sell your phone number.";

export const PARENT_SMS_CONSENT_LABEL = "Send me Study Hall text alerts";

export const PARENT_SMS_CONSENT_HELP =
  "Operational texts only — reminders, missed Study Halls, billing attention, and urgent session messages. Not marketing. Message and data rates may apply. Consent is optional; email continues either way.";

export const PARENT_SMS_OFF_HELP =
  "Text alerts are off. You'll still receive important updates by email.";

export const PARENT_SMS_TWILIO_RESTART_NOTE =
  "If you previously texted STOP, also reply START to our number so texts can resume.";

/**
 * @param {unknown} phone
 * @returns {boolean}
 */
export function isUsableParentPhone(phone) {
  return typeof phone === "string" && PARENT_PHONE_E164.test(phone.trim());
}

/**
 * @param {{
 *   phone_e164?: string | null,
 *   sms_transactional_opt_in?: boolean | null,
 * } | null | undefined} profile
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
export function parentTransactionalSmsEligible(profile) {
  if (!profile) return { ok: false, reason: "missing_profile" };
  if (!isUsableParentPhone(profile.phone_e164)) return { ok: false, reason: "no_phone" };
  if (profile.sms_transactional_opt_in !== true) return { ok: false, reason: "sms_not_opted_in" };
  return { ok: true };
}

/**
 * Boolean form of the same predicate. Never infer consent from phone alone.
 * @param {unknown} profile
 */
export function isParentTransactionalSmsEligible(profile) {
  return parentTransactionalSmsEligible(profile).ok === true;
}

/**
 * Durable SMS claim key, distinct from the email key for the same event.
 * @param {string} emailKey
 */
export function smsIdempotencyKey(emailKey) {
  const key = String(emailKey || "").trim();
  if (!key) return null;
  return key.startsWith("sms:") ? key : `sms:${key}`;
}
