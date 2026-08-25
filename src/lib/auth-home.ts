import { DASHBOARD_PATH_BY_ROLE, type Role } from "@/lib/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * After login/confirm, send the user to the correct home for their role/state.
 * Pending Guide applicants keep role=student but land on the applicant UX.
 * Server-only (uses cookies via supabase/server).
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
