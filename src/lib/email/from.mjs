/**
 * PR7F — customer-facing email sender identity.
 *
 * Inbox display name is "Study Hall at Home" (no parentheses). Body copy may
 * still use the official lockup "Study Hall (at home)".
 *
 * Never send with a .example / example.com placeholder. Production must set
 * EMAIL_FROM to a Resend-verified address, e.g.
 *   Study Hall at Home <notifications@studyhallathome.com>
 * only after that domain/address is verified. This module does not hardcode
 * that live address as a send fallback.
 */

export const EMAIL_SENDER_DISPLAY_NAME = "Study Hall at Home";

/** Documented stub only. Never used as a live From when a provider is configured. */
export const EMAIL_FROM_PLACEHOLDER = "Study Hall at Home <notifications@studyhallathome.example>";

const PLACEHOLDER_FROM_RE = /@(?:[^>\s]*\.)?example(?:\.com)?\b/i;

/**
 * @param {unknown} from
 */
export function isPlaceholderEmailFrom(from) {
  const s = String(from || "").trim();
  if (!s) return true;
  return PLACEHOLDER_FROM_RE.test(s);
}

/**
 * Usable From header, or null when missing/placeholder.
 * Reads env at call time.
 * @returns {string | null}
 */
export function resolveEmailFrom() {
  const from = String(process.env.EMAIL_FROM || "").trim();
  if (!from || isPlaceholderEmailFrom(from)) return null;
  return from;
}

/**
 * Optional Reply-To. Unset when no real support inbox is configured.
 * Do not invent an address.
 * @returns {string | null}
 */
export function resolveEmailReplyTo() {
  const value = String(process.env.EMAIL_REPLY_TO || "").trim();
  if (!value || isPlaceholderEmailFrom(value)) return null;
  return value;
}

/**
 * Production (Vercel Production) must never fall through to a placeholder.
 * Preview/dev still refuse sending a placeholder when Resend is configured;
 * they simply skip.
 */
export function isProductionEmailEnv() {
  return String(process.env.VERCEL_ENV || "").trim() === "production";
}
