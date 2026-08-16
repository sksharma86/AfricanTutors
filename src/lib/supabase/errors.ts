/**
 * Maps raw Supabase Auth error messages to short, friendly, nontechnical
 * copy. Users should never see something like `AuthApiError:
 * invalid_credentials` — see ARCHITECTURE.md > "User Experience".
 */
export function getAuthErrorMessage(error: unknown): string {
  const rawMessage =
    error && typeof error === "object" && "message" in error
      ? String((error as { message?: unknown }).message ?? "")
      : String(error ?? "");

  const message = rawMessage.toLowerCase();

  if (message.includes("invalid login credentials")) {
    return "The email or password you entered is incorrect.";
  }
  if (message.includes("email not confirmed")) {
    return "Please confirm your email address before logging in — check your inbox for a confirmation link.";
  }
  if (message.includes("user already registered") || message.includes("already registered")) {
    return "An account with that email already exists. Try logging in instead.";
  }
  if (message.includes("password should be at least")) {
    return "Please choose a password with at least 8 characters.";
  }
  if (message.includes("rate limit") || message.includes("only request this after")) {
    return "You've tried this a few too many times. Please wait a minute and try again.";
  }
  if (message.includes("unable to validate email") || message.includes("invalid email")) {
    return "Please enter a valid email address.";
  }
  if (message.includes("network") || message.includes("fetch")) {
    return "We couldn't reach the server. Please check your connection and try again.";
  }

  return "Something went wrong. Please try again in a moment.";
}
