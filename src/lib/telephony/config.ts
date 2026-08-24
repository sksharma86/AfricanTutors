/**
 * Twilio Voice + SMS configuration. Server-only secrets — never NEXT_PUBLIC_*.
 * Mirrors Stripe/Daily/Resend: missing config fails safely (no fake success).
 * Values are read at call time so tests can set env before invoking helpers.
 */
export function getTwilioConfig() {
  return {
    accountSid: process.env.TWILIO_ACCOUNT_SID || "",
    authToken: process.env.TWILIO_AUTH_TOKEN || "",
    phoneNumber: process.env.TWILIO_PHONE_NUMBER || "",
  };
}

/** True when outbound call + SMS can be attempted. */
export function isTwilioConfigured(): boolean {
  const c = getTwilioConfig();
  return Boolean(c.accountSid && c.authToken && c.phoneNumber);
}

/** @deprecated Prefer isTwilioConfigured() — kept as alias for source tests. */
export const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
export const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
export const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;
