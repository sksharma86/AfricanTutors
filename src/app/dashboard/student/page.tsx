import type { Metadata } from "next";

import { ComingSoonCard } from "@/components/dashboard/coming-soon-card";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Student Dashboard",
};

// Always personalized, private data — never statically cache this page.
export const dynamic = "force-dynamic";

export default async function StudentDashboardPage() {
  const supabase = await createSupabaseServerClient();

  let displayName = "there";

  if (supabase) {
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", userData.user.id)
        .single();
      if (profile) displayName = profile.display_name;
    }
  }

  return (
    <DashboardShell
      role="student"
      title={`Welcome back, ${displayName}`}
      description="This is where you'll manage tutoring sessions, bookings, and messages."
      navItems={[
        { label: "Overview", available: true },
        { label: "Book Tutoring", available: false },
        { label: "Bookings", available: false },
        { label: "Sessions", available: false },
        { label: "Messages", available: false },
        { label: "Session History", available: false },
      ]}
    >
      <div className="grid gap-6 sm:grid-cols-2">
        <ComingSoonCard
          title="Book a session"
          description="Tell us what your student needs and book a live, one-on-one tutoring session with African Tutors."
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
