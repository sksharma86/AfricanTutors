import { DASHBOARD_PATH_BY_ROLE, type Role } from "@/lib/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

/**
 * After login/confirm, send the user to the correct home for their role/state.
 * Pending Guide applicants keep role=student but land on the applicant UX.
 */
export async function resolvePostAuthHome(userId: string, role: Role): Promise<string> {
  if (role === "admin") return DASHBOARD_PATH_BY_ROLE.admin;
  if (role === "tutor") return DASHBOARD_PATH_BY_ROLE.tutor;

  const supabase = await createSupabaseServerClient();
  if (supabase) {
    const { data: tp } = await supabase
      .from("tutor_profiles")
      .select("status")
      .eq("profile_id", userId)
      .maybeSingle();
    if (tp?.status === "pending" || tp?.status === "suspended") {
      return "/dashboard/applicant";
    }
  }
  return DASHBOARD_PATH_BY_ROLE.student;
}

/** Browser-safe auth callback URL for emailRedirectTo / recovery. */
export function authCallbackUrl(origin: string, next = "/dashboard"): string {
  const safeNext = sanitizeNextPath(next, "/dashboard");
  return `${origin.replace(/\/$/, "")}/auth/callback?next=${encodeURIComponent(safeNext)}`;
}
