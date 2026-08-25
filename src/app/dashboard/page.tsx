import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { getGuideApplicantInfo } from "@/lib/guide-applicant";
import { DASHBOARD_PATH_BY_ROLE } from "@/lib/roles";

export default async function DashboardIndexPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?redirectTo=/dashboard");
  }

  if (user.role === "student") {
    const applicant = await getGuideApplicantInfo(user.id);
    if (applicant) {
      redirect("/dashboard/applicant");
    }
  }

  redirect(DASHBOARD_PATH_BY_ROLE[user.role]);
}
