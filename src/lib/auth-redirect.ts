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

/** Deep-link after login for emergency open-coverage offers only. */
export function isSafeOpenCoveragePath(path: string | null | undefined): boolean {
  return /^\/dashboard\/tutor\/open-coverage\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    String(path ?? ""),
  );
}

/** Browser-safe auth callback URL for emailRedirectTo / recovery. */
export function authCallbackUrl(origin: string, next = "/dashboard"): string {
  const safeNext = sanitizeNextPath(next, "/dashboard");
  return `${origin.replace(/\/$/, "")}/auth/callback?next=${encodeURIComponent(safeNext)}`;
}
