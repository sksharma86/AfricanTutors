import { createSupabaseServerClient } from "@/lib/supabase/server";

export type GuideApplicantStatus = "pending" | "suspended";

export interface GuideApplicantInfo {
  status: GuideApplicantStatus;
  /** Approximate application time (profile created_at; tutor_profiles has no submitted_at). */
  submittedAt: string | null;
  displayName: string | null;
}

/**
 * Pending / suspended Guide applicants keep `profiles.role = 'student'` until
 * admin approval. Detect them so we can show the applicant experience instead
 * of the parent portal — without changing the security role model.
 */
export async function getGuideApplicantInfo(
  userId: string,
): Promise<GuideApplicantInfo | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const [{ data: tp }, { data: profile }] = await Promise.all([
    supabase.from("tutor_profiles").select("status").eq("profile_id", userId).maybeSingle(),
    supabase.from("profiles").select("display_name, created_at, role").eq("id", userId).maybeSingle(),
  ]);

  if (!tp || (tp.status !== "pending" && tp.status !== "suspended")) {
    return null;
  }
  // Approved Guides have role=tutor; if role is somehow still elevated, do not
  // treat as applicant (approval transition uses approve_tutor RPC).
  if (profile?.role === "tutor" || profile?.role === "admin") {
    return null;
  }

  return {
    status: tp.status as GuideApplicantStatus,
    submittedAt: profile?.created_at ?? null,
    displayName: profile?.display_name ?? null,
  };
}
