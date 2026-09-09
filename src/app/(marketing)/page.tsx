import type { Metadata } from "next";

import { HomeClose } from "@/components/marketing/galaxy/home-close";
import { HomeEvening } from "@/components/marketing/galaxy/home-evening";
import { HomeGuide } from "@/components/marketing/galaxy/home-guide";
import { HomeHero } from "@/components/marketing/galaxy/home-hero";
import { HomeOneToOne } from "@/components/marketing/galaxy/home-one-to-one";
import { HomePlanWeek } from "@/components/marketing/galaxy/home-plan-week";
import { HomePricing } from "@/components/marketing/galaxy/home-pricing";
import { HomeRelief } from "@/components/marketing/galaxy/home-relief";
import { HomeRoutine } from "@/components/marketing/galaxy/home-routine";
import { HomeTrust } from "@/components/marketing/galaxy/home-trust";
import { getCurrentUser } from "@/lib/auth";
import { getGuideApplicantInfo } from "@/lib/guide-applicant";
import { FREE_TRIAL_CTA } from "@/lib/pricing";
import { DASHBOARD_PATH_BY_ROLE } from "@/lib/roles";

export const metadata: Metadata = {
  title: "Homework time. Handled.",
  description:
    "One child. One Guide. One private 60-minute Study Hall — focused on the homework they already have. First Study Hall free.",
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
    <div className="galaxy-home">
      <HomeHero primaryHref={primary.href} primaryLabel={primary.label} />
      <HomeOneToOne />
      <HomeEvening />
      <HomeRelief />
      <HomeRoutine />
      <HomeGuide />
      <HomePlanWeek primaryHref={primary.href} primaryLabel={primary.label} />
      <HomePricing ctaHref={primary.href} ctaLabel={primary.label} />
      <HomeTrust />
      <HomeClose primaryHref={primary.href} primaryLabel={primary.label} />
    </div>
  );
}
