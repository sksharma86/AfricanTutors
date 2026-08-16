import type { Metadata } from "next";

import { ComingSoonCard } from "@/components/dashboard/coming-soon-card";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

export const metadata: Metadata = {
  title: "Admin Dashboard",
};

export default function AdminDashboardPage() {
  return (
    <DashboardShell
      role="admin"
      title="Platform Overview"
      description="This is where you'll manage students, tutors, bookings, and platform settings."
      navItems={[
        { label: "Overview", available: true },
        { label: "Students", available: false },
        { label: "Tutors", available: false },
        { label: "Subjects", available: false },
        { label: "Bookings", available: false },
        { label: "Payments", available: false },
        { label: "Circumvention Flags", available: false },
        { label: "Settings", available: false },
      ]}
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
        <ComingSoonCard
          title="Circumvention review"
          description="Review flagged messages or activity that may indicate off-platform contact attempts."
        />
        <ComingSoonCard
          title="Platform settings"
          description="Manage subjects, pricing rules, and other platform-wide settings."
        />
      </div>
    </DashboardShell>
  );
}
