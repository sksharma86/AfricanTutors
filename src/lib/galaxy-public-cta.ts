import { getCurrentUser } from "@/lib/auth";
import { getGuideApplicantInfo } from "@/lib/guide-applicant";
import { FREE_TRIAL_CTA } from "@/lib/pricing";
import { DASHBOARD_PATH_BY_ROLE } from "@/lib/roles";

export async function getGalaxyPublicCta() {
  const user = await getCurrentUser();
  const applicant = user?.role === "student" ? await getGuideApplicantInfo(user.id) : null;

  if (!user) {
    return { href: "/signup", label: FREE_TRIAL_CTA };
  }
  if (applicant) {
    return { href: "/dashboard/applicant", label: "View application status" };
  }
  if (user.role === "student") {
    return { href: "/dashboard/student/book", label: "Book a Study Hall" };
  }
  return { href: DASHBOARD_PATH_BY_ROLE[user.role], label: "Go to dashboard" };
}
