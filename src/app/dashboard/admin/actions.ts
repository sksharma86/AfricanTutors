"use server";

import { revalidatePath } from "next/cache";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { TutorStatus } from "@/lib/supabase/database.types";

export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Approves, rejects, or suspends a tutor application.
 *
 * This calls the `admin_set_tutor_status` Postgres function (see
 * supabase/migrations/20260816000001_admin_tutor_review.sql), which is the
 * ONLY way tutor_profiles.status can change. The function itself checks
 * that the caller is an admin — this server action does not (and cannot)
 * grant that authority; it just forwards the request using the current
 * user's own session. A non-admin calling this simply gets an error back.
 */
export async function setTutorApplicationStatus(
  tutorId: string,
  newStatus: TutorStatus,
  note?: string,
): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Authentication is not configured yet." };
  }

  const { error } = await supabase.rpc("admin_set_tutor_status", {
    target_tutor_id: tutorId,
    new_status: newStatus,
    note: note?.trim() ? note.trim() : null,
  });

  if (error) {
    const friendly = error.message.toLowerCase().includes("administrators")
      ? "You don't have permission to do that."
      : "Something went wrong. Please try again.";
    return { ok: false, error: friendly };
  }

  revalidatePath("/dashboard/admin");
  return { ok: true };
}
