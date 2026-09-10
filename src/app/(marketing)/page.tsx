import type { Metadata } from "next";

import { HomeEvening } from "@/components/marketing/home/evening";
import { HomeExplainer } from "@/components/marketing/home/explainer";
import { HomeHero } from "@/components/marketing/home/hero";
import { HomePortal } from "@/components/marketing/home/portal";
import { HomePricing } from "@/components/marketing/home/pricing";
import { getCurrentUser } from "@/lib/auth";
import { getGuideApplicantInfo } from "@/lib/guide-applicant";
import { FREE_TRIAL_CTA } from "@/lib/pricing";
import { DASHBOARD_PATH_BY_ROLE } from "@/lib/roles";

export const metadata: Metadata = {
  title: "Give your child an edge.",
  description:
    "Private, one on one Study Halls. Right at home. First Study Hall free. No credit card required.",
  alternates: { canonical: "/" },
};

export default async function HomePage() {
  const user = await getCurrentUser();
  const applicant = user?.role === "student" ? await getGuideApplicantInfo(user.id) : null;

  const primary = !user
    ? { href: "/signup", label: FREE_TRIAL_CTA }
    : applicant
      ? { href: "/dashboard/applicant", label: "View application status" }
      : user.role === "student"
        ? { href: "/dashboard/student/book", label: "Book a Study Hall" }
        : { href: DASHBOARD_PATH_BY_ROLE[user.role], label: "Go to dashboard" };

  return (
    <div className="sh-home">
      <HomeHero primaryHref={primary.href} primaryLabel={primary.label} />
      <HomeExplainer />
      <HomeEvening />
      <HomePortal />
      <HomePricing ctaHref={primary.href} ctaLabel={primary.label} />
    </div>
  );
}
