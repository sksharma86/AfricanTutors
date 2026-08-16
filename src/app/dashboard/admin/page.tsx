import type { Metadata } from "next";

import { ComingSoonCard } from "@/components/dashboard/coming-soon-card";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import {
  TutorApplicationReviewCard,
  type TutorApplicationSummary,
} from "@/components/dashboard/tutor-application-review-card";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { TutorStatus } from "@/lib/supabase/database.types";

export const metadata: Metadata = {
  title: "Admin Dashboard",
};

// Always personalized, private data — never statically cache this page.
export const dynamic = "force-dynamic";

const NAV_ITEMS = [
  { label: "Overview", available: true },
  { label: "Students", available: false },
  { label: "Tutors", available: false },
  { label: "Subjects", available: false },
  { label: "Bookings", available: false },
  { label: "Payments", available: false },
  { label: "Circumvention Flags", available: false },
  { label: "Settings", available: false },
];

const STATUS_PRIORITY: Record<TutorStatus, number> = {
  pending: 0,
  approved: 1,
  rejected: 2,
  suspended: 3,
};

async function loadTutorApplications(
  supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
): Promise<TutorApplicationSummary[]> {
  const { data: tutorProfiles } = await supabase.from("tutor_profiles").select("*");
  if (!tutorProfiles || tutorProfiles.length === 0) return [];

  const tutorIds = tutorProfiles.map((tutor) => tutor.id);

  const [{ data: profiles }, { data: subjectLinks }, { data: subjects }] = await Promise.all([
    supabase.from("profiles").select("id, display_name").in("id", tutorIds),
    supabase.from("tutor_profile_subjects").select("tutor_id, subject_id").in("tutor_id", tutorIds),
    supabase.from("subjects").select("id, name"),
  ]);

  const displayNameById = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));
  const subjectNameById = new Map((subjects ?? []).map((s) => [s.id, s.name]));

  const subjectNamesByTutorId = new Map<string, string[]>();
  for (const link of subjectLinks ?? []) {
    const name = subjectNameById.get(link.subject_id);
    if (!name) continue;
    const existing = subjectNamesByTutorId.get(link.tutor_id) ?? [];
    existing.push(name);
    subjectNamesByTutorId.set(link.tutor_id, existing);
  }

  return tutorProfiles
    .map((tutor) => ({
      id: tutor.id,
      displayName: displayNameById.get(tutor.id) ?? "Unknown",
      status: tutor.status,
      headline: tutor.headline,
      bio: tutor.bio,
      education: tutor.education,
      yearsExperience: tutor.years_experience,
      applicationNotes: tutor.application_notes,
      submittedAt: tutor.submitted_at,
      subjectNames: subjectNamesByTutorId.get(tutor.id) ?? [],
    }))
    .sort((a, b) => {
      const statusDiff = STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status];
      if (statusDiff !== 0) return statusDiff;
      return (b.submittedAt ?? "").localeCompare(a.submittedAt ?? "");
    });
}

export default async function AdminDashboardPage() {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return (
      <DashboardShell
        role="admin"
        title="Platform Overview"
        description="This is where you'll manage students, tutors, bookings, and platform settings."
        navItems={NAV_ITEMS}
      >
        <div className="grid gap-6 sm:grid-cols-2">
          <ComingSoonCard
            title="Tutor approvals"
            description="Review and approve tutor applications before they gain tutor access."
          />
          <ComingSoonCard
            title="Bookings and payments"
            description="View all bookings, payments, and reassign tutors when needed."
          />
        </div>
      </DashboardShell>
    );
  }

  const applications = await loadTutorApplications(supabase);
  const pendingCount = applications.filter((application) => application.status === "pending").length;

  return (
    <DashboardShell
      role="admin"
      title="Platform Overview"
      description="This is where you'll manage students, tutors, bookings, and platform settings."
      navItems={NAV_ITEMS}
    >
      <div className="space-y-6">
        <div>
          <h2 className="font-display text-lg font-semibold text-ink-900">
            Tutor applications {pendingCount > 0 ? `(${pendingCount} pending)` : ""}
          </h2>
          <p className="mt-1 text-sm text-ink-500">
            Approving a tutor gives them access to the Tutor Dashboard. Rejecting or suspending
            removes it. These actions only ever change tutor status — never a student&apos;s data.
          </p>

          {applications.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-ink-200 bg-white p-6 text-sm text-ink-500">
              No tutor applications yet.
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              {applications.map((application) => (
                <TutorApplicationReviewCard key={application.id} application={application} />
              ))}
            </div>
          )}
        </div>

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
            title="Students"
            description="View and manage student accounts."
          />
          <ComingSoonCard
            title="Platform settings"
            description="Manage subjects, pricing rules, and other platform-wide settings."
          />
        </div>
      </div>
    </DashboardShell>
  );
}
