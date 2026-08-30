/**
 * Twilio WhatsApp sender config. Separate from parent SMS From.
 * Values are read at call time so tests can set env before invoking helpers.
 */

export function getWhatsAppConfig() {
  return {
    accountSid: process.env.TWILIO_ACCOUNT_SID || "",
    authToken: process.env.TWILIO_AUTH_TOKEN || "",
    from: process.env.TWILIO_WHATSAPP_FROM || "",
    attendanceContentSid: process.env.TWILIO_WA_CONTENT_SID_ATTENDANCE || "",
    replacementContentSid: process.env.TWILIO_WA_CONTENT_SID_REPLACEMENT || "",
    openCoverageContentSid: process.env.TWILIO_WA_CONTENT_SID_OPEN_COVERAGE || "",
    disabled: process.env.TWILIO_WHATSAPP_DISABLED === "1",
  };
}

/** True when Guide WhatsApp can be attempted. Missing config fails safely. */
export function isWhatsAppConfigured() {
  const c = getWhatsAppConfig();
  return Boolean(c.accountSid && c.authToken && c.from && !c.disabled);
}
