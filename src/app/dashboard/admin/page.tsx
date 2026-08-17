import type { Metadata } from "next";

import {
  AdminConsole,
  type AdminBooking,
  type AdminSubject,
  type AdminTutor,
  type AdminTutorSubject,
} from "@/components/dashboard/admin-console";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { Button } from "@/components/ui/button";
import { requireRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { approveTutorAction } from "./actions";

export const metadata: Metadata = {
  title: "Admin Dashboard",
};

interface PendingTutor {
  profile_id: string;
  profiles: { display_name: string | null } | null;
}

export default async function AdminDashboardPage() {
  await requireRole("admin", "/dashboard/admin");
  const supabase = await createSupabaseServerClient();

  const [{ data: pending }, { data: subjects }, { data: tutorRows }, { data: tutorSubjects }, { data: bookings }] =
    await Promise.all([
      supabase!
        .from("tutor_profiles")
        .select("profile_id, profiles!tutor_profiles_profile_id_fkey(display_name)")
        .eq("status", "pending"),
      supabase!.from("subjects").select("id, name, category, is_active").order("category").order("name"),
      supabase!
        .from("tutor_profiles")
        .select("profile_id, profiles!tutor_profiles_profile_id_fkey(display_name)")
        .eq("status", "approved"),
      supabase!.from("tutor_subjects").select("tutor_id, subject_id"),
      supabase!
        .from("bookings")
        .select(
          "id, public_reference, subject_name, other_subject_text, subject_id, student_first_name, tutor_display_name, scheduled_start, duration_minutes, status, is_free_trial, price_cents, payment_status",
        )
        .order("scheduled_start", { ascending: false, nullsFirst: false }),
    ]);

  const pendingTutors = (pending ?? []) as unknown as PendingTutor[];
  const tutors = ((tutorRows ?? []) as unknown as PendingTutor[]).map((t) => ({
    profile_id: t.profile_id,
    display_name: t.profiles?.display_name ?? null,
  })) as AdminTutor[];

  return (
    <DashboardShell
      role="admin"
      title="Platform Overview"
      description="Manage tutors, subjects, availability, and bookings."
      navItems={[
        { label: "Overview", available: true },
        { label: "Tutor Approvals", available: true },
        { label: "Bookings", available: true },
        { label: "Subjects", available: true },
        { label: "Payments", available: false },
        { label: "Settings", available: false },
      ]}
    >
      <section className="mb-8 rounded-2xl border border-ink-100 bg-white p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-ink-900">Tutor approvals</h2>
          <span className="rounded-full bg-ink-100 px-2.5 py-0.5 text-xs font-semibold text-ink-600">
            {pendingTutors.length} pending
          </span>
        </div>
        {pendingTutors.length === 0 ? (
          <p className="mt-6 rounded-lg border border-dashed border-ink-200 px-4 py-6 text-center text-sm text-ink-400">
            No pending tutor applications.
          </p>
        ) : (
          <ul className="mt-5 divide-y divide-ink-100">
            {pendingTutors.map((tutor) => (
              <li key={tutor.profile_id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium text-ink-900">
                    {tutor.profiles?.display_name ?? "Unnamed applicant"}
                  </p>
                  <p className="text-xs text-ink-400">Applied to teach · awaiting review</p>
                </div>
                <form action={approveTutorAction}>
                  <input type="hidden" name="profileId" value={tutor.profile_id} />
                  <Button type="submit" className="px-4 py-2 text-sm">
                    Approve
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <AdminConsole
        subjects={(subjects ?? []) as AdminSubject[]}
        tutors={tutors}
        tutorSubjects={(tutorSubjects ?? []) as AdminTutorSubject[]}
        bookings={(bookings ?? []) as AdminBooking[]}
      />
    </DashboardShell>
  );
}
