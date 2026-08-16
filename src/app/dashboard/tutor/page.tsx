import type { Metadata } from "next";

import { ComingSoonCard } from "@/components/dashboard/coming-soon-card";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

export const metadata: Metadata = {
  title: "Tutor Dashboard",
};

export default function TutorDashboardPage() {
  return (
    <DashboardShell
      role="tutor"
      title="Welcome back"
      description="This is where you'll manage your availability, sessions, and earnings."
      navItems={[
        { label: "Overview", available: true },
        { label: "Availability", available: false },
        { label: "Sessions", available: false },
        { label: "Earnings", available: false },
        { label: "Messages", available: false },
      ]}
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
        <ComingSoonCard
          title="Earnings"
          description="Track what you've earned, kept separate from any student payment details."
        />
        <ComingSoonCard
          title="Messages"
          description="Communicate with students about sessions without needing personal contact details."
        />
      </div>
    </DashboardShell>
  );
}
