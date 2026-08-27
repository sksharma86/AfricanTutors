"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/lib/auth";
import { notifyTutorApproved } from "@/lib/notify";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getServiceSupabase } from "@/lib/supabase/service";

/**
 * Approves a pending tutor application. Authorization is enforced twice:
 * here (server action) and again inside the `approve_tutor` SECURITY DEFINER
 * function via `is_admin()` in Postgres, so a forged request can never
 * promote a tutor even if this layer were bypassed.
 */
export async function approveTutorAction(formData: FormData) {
  const profileId = String(formData.get("profileId") ?? "");
  if (!profileId) return;

  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    throw new Error("Not authorized");
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    throw new Error("Supabase not configured");
  }

  const { error } = await supabase.rpc("approve_tutor", { target: profileId });
  if (error) {
    throw new Error(error.message);
  }

  // Best-effort, idempotent tutor-approved email (never blocks approval).
  try {
    const { data: p } = await getServiceSupabase().from("profiles").select("display_name").eq("id", profileId).maybeSingle();
    await notifyTutorApproved(profileId, p?.display_name ?? null);
  } catch {
    /* ignore */
  }

  revalidatePath("/dashboard/admin");
  revalidatePath("/dashboard/admin/guides");
  revalidatePath("/dashboard/applicant");
  revalidatePath("/dashboard/tutor");
}
