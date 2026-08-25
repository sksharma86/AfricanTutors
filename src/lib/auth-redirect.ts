/**
 * Pure auth redirect helpers — safe for client and server bundles.
 * Do not import supabase/server here (breaks client components).
 */

/**
 * Allow only same-origin relative paths for post-auth redirects.
 * Blocks open redirects (`//evil`, absolute URLs, protocol-relative).
 */
export function sanitizeNextPath(raw: string | null | undefined, fallback = "/dashboard"): string {
  if (!raw || typeof raw !== "string") return fallback;
  const next = raw.trim();
  if (!next.startsWith("/")) return fallback;
  if (next.startsWith("//")) return fallback;
  if (next.includes("://")) return fallback;
  if (next.includes("\\")) return fallback;
  return next;
}

/** Browser-safe auth callback URL for emailRedirectTo / recovery. */
export function authCallbackUrl(origin: string, next = "/dashboard"): string {
  const safeNext = sanitizeNextPath(next, "/dashboard");
  return `${origin.replace(/\/$/, "")}/auth/callback?next=${encodeURIComponent(safeNext)}`;
}
