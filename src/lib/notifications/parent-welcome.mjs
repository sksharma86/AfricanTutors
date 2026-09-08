/**
 * Parent welcome eligibility (pure). Welcome is sent only after successful
 * parent account creation — never from Parent Home, never from the client.
 */

/**
 * @param {{
 *   requestedRole?: string | null,
 *   user?: { id?: string | null, identities?: unknown[] | null } | null,
 *   error?: { message?: string } | null,
 * }} input
 * @returns {boolean}
 */
export function parentWelcomeEligible(input = {}) {
  if (input.error) return false;
  const user = input.user;
  if (!user?.id) return false;
  if (input.requestedRole === "tutor") return false;
  if (Array.isArray(user.identities) && user.identities.length === 0) return false;
  return true;
}

export function welcomeIdempotencyKey(accountId) {
  return `welcome:${accountId}`;
}

export function friendlySignupError(message) {
  const text = String(message || "");
  if (/already registered|already been registered|User already registered/i.test(text)) {
    return "An account with that email already exists. Sign in, or reset your password.";
  }
  if (/password/i.test(text) && /weak|least|characters/i.test(text)) {
    return "Choose a stronger password (at least 8 characters).";
  }
  if (/rate limit|too many/i.test(text)) {
    return "Too many attempts. Please wait a minute and try again.";
  }
  return "We couldn’t create your account right now. Please try again.";
}
