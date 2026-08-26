import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { GuideApplicantPanel } from "@/components/dashboard/guide-applicant-panel";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { requireUser } from "@/lib/auth";
import { getGuideApplicantInfo } from "@/lib/guide-applicant";
import { DASHBOARD_PATH_BY_ROLE } from "@/lib/roles";

export const metadata: Metadata = {
  title: "Guide application · Study Hall (at home)",
};

export default async function GuideApplicantPage() {
  const user = await requireUser("/dashboard/applicant");

  if (user.role === "tutor") {
    redirect(DASHBOARD_PATH_BY_ROLE.tutor);
  }
  if (user.role === "admin") {
    redirect(DASHBOARD_PATH_BY_ROLE.admin);
  }

  const info = await getGuideApplicantInfo(user.id);
  if (!info) {
    // Genuine parent account — send to customer dashboard.
    redirect(DASHBOARD_PATH_BY_ROLE.student);
  }

  return (
    <DashboardShell
      role="student"
      badgeLabel="Guide applicant"
      title="Application status"
      description="Your Study Hall Guide application is being reviewed."
      navItems={[{ label: "Application", href: "/dashboard/applicant" }]}
    >
      <GuideApplicantPanel info={info} />
    </DashboardShell>
  );
}
