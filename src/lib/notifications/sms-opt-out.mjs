/**
 * PR7F — classify inbound SMS keywords for transactional opt-out.
 * Twilio Advanced Opt-Out may also send OptOutType. We persist our own
 * preference either way; we do not invent Twilio auto-replies.
 */

const OPT_OUT = new Set(["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"]);
const OPT_IN = new Set(["START", "YES", "UNSTOP"]);

/**
 * @param {string | null | undefined} body
 * @param {string | null | undefined} [optOutType] Twilio Advanced Opt-Out field
 * @returns {"opt_out" | "opt_in" | "help" | null}
 */
export function classifyInboundSmsKeyword(body, optOutType) {
  const type = String(optOutType || "").trim().toUpperCase();
  if (type === "STOP") return "opt_out";
  if (type === "START") return "opt_in";
  if (type === "HELP") return "help";

  const first = String(body || "")
    .trim()
    .split(/\s+/)[0]
    ?.replace(/[^A-Za-z]/g, "")
    .toUpperCase();
  if (!first) return null;
  if (OPT_OUT.has(first)) return "opt_out";
  if (OPT_IN.has(first)) return "opt_in";
  if (first === "HELP") return "help";
  return null;
}

/** Normalize Twilio From to E.164-ish +digits, or null. */
export function inboundFromE164(from) {
  const raw = String(from || "").trim();
  if (!raw) return null;
  const digits = raw.replace(/[^\d+]/g, "");
  if (/^\+[1-9][0-9]{7,14}$/.test(digits)) return digits;
  if (/^[1-9][0-9]{7,14}$/.test(digits)) return `+${digits}`;
  return null;
}
