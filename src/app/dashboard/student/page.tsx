import type { Metadata } from "next";

import { ComingSoonCard } from "@/components/dashboard/coming-soon-card";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

export const metadata: Metadata = {
  title: "Student Dashboard",
};

export default function StudentDashboardPage() {
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
