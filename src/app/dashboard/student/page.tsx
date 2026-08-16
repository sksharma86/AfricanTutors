import type { Metadata } from "next";

import { ComingSoonCard } from "@/components/dashboard/coming-soon-card";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { requireRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Student Dashboard",
};

export default async function StudentDashboardPage() {
  await requireRole("student", "/dashboard/student");

  // A user who applied to tutor keeps a `student` role (and lands here) until
  // an admin approves their application. Surface that pending state.
  const supabase = await createSupabaseServerClient();
  const { data: tutorApplication } = supabase
    ? await supabase.from("tutor_profiles").select("status").maybeSingle()
    : { data: null };

  return (
    <DashboardShell
      role="student"
      title="Welcome back"
      description="This is where you'll manage tutoring sessions, bookings, and messages."
      navItems={[
        { label: "Overview", available: true },
        { label: "Find a Tutor", available: false },
        { label: "Bookings", available: false },
        { label: "Sessions", available: false },
        { label: "Messages", available: false },
        { label: "Session History", available: false },
      ]}
    >
      {tutorApplication?.status === "pending" ? (
        <div className="mb-6 rounded-lg border border-brand-200 bg-brand-50 p-4 text-sm text-brand-800">
          Your tutor application is <span className="font-semibold">pending review</span>. You&apos;ll
          get tutor access once an administrator approves it.
        </div>
      ) : null}

      <div className="grid gap-6 sm:grid-cols-2">
        <ComingSoonCard
          title="Book a tutor"
          description="Search for tutors by subject and availability, and book a session directly on the platform."
        />
        <ComingSoonCard
          title="Upcoming sessions"
          description="See your scheduled sessions and join them from here when it's time."
        />
        <ComingSoonCard
          title="Messages"
          description="Message your tutor about a session without sharing personal contact details."
        />
        <ComingSoonCard
          title="Session history"
          description="Review past sessions and any recordings shared with you."
        />
      </div>
    </DashboardShell>
  );
}
