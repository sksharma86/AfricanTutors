import type { Metadata } from "next";

import { ComingSoonCard } from "@/components/dashboard/coming-soon-card";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { TutorApplicationForm } from "@/components/dashboard/tutor-application-form";
import { TutorStatusBanner } from "@/components/dashboard/tutor-status-banner";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Tutor Dashboard",
};

// Always personalized, private data — never statically cache this page.
export const dynamic = "force-dynamic";

const NAV_ITEMS = [
  { label: "Overview", available: true },
  { label: "Availability", available: false },
  { label: "Sessions", available: false },
  { label: "Earnings", available: false },
  { label: "Messages", available: false },
];

export default async function TutorDashboardPage() {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return (
      <DashboardShell
        role="tutor"
        title="Welcome back"
        description="This is where you'll manage your availability, sessions, and earnings."
        navItems={NAV_ITEMS}
      >
        <div className="grid gap-6 sm:grid-cols-2">
          <ComingSoonCard
            title="Set your availability"
            description="Let students know when you're available to teach."
          />
          <ComingSoonCard
            title="Assigned sessions"
            description="See sessions booked with you and join them directly through the platform."
          />
        </div>
      </DashboardShell>
    );
  }

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return null;
  }

  const tutorId = userData.user.id;

  const [{ data: profile }, { data: tutorProfile }, { data: allSubjects }, { data: mySubjectRows }] =
    await Promise.all([
      supabase.from("profiles").select("display_name").eq("id", tutorId).single(),
      supabase.from("tutor_profiles").select("*").eq("id", tutorId).single(),
      supabase.from("subjects").select("id, name, category").eq("is_active", true).order("name"),
      supabase.from("tutor_profile_subjects").select("subject_id").eq("tutor_id", tutorId),
    ]);

  const displayName = profile?.display_name ?? "there";
  const status = tutorProfile?.status ?? "pending";
  const selectedSubjectIds = (mySubjectRows ?? []).map((row) => row.subject_id);

  return (
    <DashboardShell
      role="tutor"
      title={`Welcome back, ${displayName}`}
      description="This is where you'll manage your availability, sessions, and earnings."
      navItems={NAV_ITEMS}
    >
      <div className="space-y-6">
        {status !== "approved" ? <TutorStatusBanner status={status} /> : null}

        {status === "pending" || status === "approved" ? (
          <TutorApplicationForm
            subjects={allSubjects ?? []}
            initialValues={{
              headline: tutorProfile?.headline ?? "",
              bio: tutorProfile?.bio ?? "",
              education: tutorProfile?.education ?? "",
              yearsExperience: tutorProfile?.years_experience ?? null,
              applicationNotes: tutorProfile?.application_notes ?? "",
            }}
            selectedSubjectIds={selectedSubjectIds}
          />
        ) : null}

        {status === "approved" ? (
          <div className="grid gap-6 sm:grid-cols-2">
            <ComingSoonCard
              title="Assigned sessions"
              description="See sessions booked with you and join them directly through the platform."
            />
            <ComingSoonCard
              title="Earnings"
              description="Track what you've earned, kept separate from any student payment details."
            />
            <ComingSoonCard
              title="Availability"
              description="Let students know when you're available to teach."
            />
            <ComingSoonCard
              title="Messages"
              description="Communicate with students about sessions without needing personal contact details."
            />
          </div>
        ) : null}
      </div>
    </DashboardShell>
  );
}
