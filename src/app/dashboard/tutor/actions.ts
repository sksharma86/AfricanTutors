"use server";

import { revalidatePath } from "next/cache";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface TutorApplicationInput {
  headline: string;
  bio: string;
  education: string;
  yearsExperience: number | null;
  applicationNotes: string;
  subjectIds: string[];
}

export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Lets a tutor (pending, approved, rejected, or suspended — anyone with
 * role = tutor) create or update their own application/profile fields and
 * subject choices. This never touches tutor_profiles.status,
 * approved_by, approved_at, or admin_notes — those columns aren't even
 * granted to the authenticated role (see the migration), so an attempt to
 * set them here would fail at the database level regardless.
 */
export async function submitTutorApplication(input: TutorApplicationInput): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Authentication is not configured yet." };
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return { ok: false, error: "Please log in and try again." };
  }

  const tutorId = userData.user.id;

  const { error: updateError } = await supabase
    .from("tutor_profiles")
    .update({
      headline: input.headline.trim() || null,
      bio: input.bio.trim() || null,
      education: input.education.trim() || null,
      years_experience: input.yearsExperience,
      application_notes: input.applicationNotes.trim() || null,
      submitted_at: new Date().toISOString(),
    })
    .eq("id", tutorId);

  if (updateError) {
    return { ok: false, error: "We couldn't save your application. Please try again." };
  }

  const { error: deleteError } = await supabase
    .from("tutor_profile_subjects")
    .delete()
    .eq("tutor_id", tutorId);

  if (deleteError) {
    return { ok: false, error: "We couldn't save your subject choices. Please try again." };
  }

  if (input.subjectIds.length > 0) {
    const { error: insertError } = await supabase
      .from("tutor_profile_subjects")
      .insert(input.subjectIds.map((subjectId) => ({ tutor_id: tutorId, subject_id: subjectId })));

    if (insertError) {
      return { ok: false, error: "We couldn't save your subject choices. Please try again." };
    }
  }

  revalidatePath("/dashboard/tutor");
  return { ok: true };
}
