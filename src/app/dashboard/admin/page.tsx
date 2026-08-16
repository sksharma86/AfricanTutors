import type { Metadata } from "next";

import { ComingSoonCard } from "@/components/dashboard/coming-soon-card";
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
  // `tutor_profiles` has two FKs to `profiles` (profile_id and approved_by), so
  // the embed must name the applicant relationship explicitly to disambiguate.
  const { data } = supabase
    ? await supabase
        .from("tutor_profiles")
        .select("profile_id, profiles!tutor_profiles_profile_id_fkey(display_name)")
        .eq("status", "pending")
    : { data: null };
  const pendingTutors = (data ?? []) as unknown as PendingTutor[];

  return (
    <DashboardShell
      role="admin"
      title="Platform Overview"
      description="This is where you'll manage students, tutors, bookings, and platform settings."
      navItems={[
        { label: "Overview", available: true },
        { label: "Tutor Approvals", available: true },
        { label: "Students", available: false },
        { label: "Subjects", available: false },
        { label: "Bookings", available: false },
        { label: "Payments", available: false },
        { label: "Circumvention Flags", available: false },
        { label: "Settings", available: false },
      ]}
    >
      <section className="mb-8 rounded-xl border border-ink-100 bg-white p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-ink-900">Tutor approvals</h2>
          <span className="rounded-full bg-ink-100 px-2.5 py-0.5 text-xs font-semibold text-ink-600">
            {pendingTutors.length} pending
          </span>
        </div>
        <p className="mt-1 text-sm text-ink-500">
          Approve tutor applications before they gain tutor access. A user keeps student-only
          access until you approve them here.
        </p>

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

      <div className="grid gap-6 sm:grid-cols-2">
        <ComingSoonCard
          title="Bookings and payments"
          description="View all bookings, payments, and reassign tutors when needed."
        />
        <ComingSoonCard
          title="Circumvention review"
          description="Review flagged messages or activity that may indicate off-platform contact attempts."
        />
        <ComingSoonCard
          title="Platform settings"
          description="Manage subjects, pricing rules, and other platform-wide settings."
        />
        <ComingSoonCard
          title="Student management"
          description="Look up student accounts and manage access when necessary."
        />
      </div>
    </DashboardShell>
  );
}
