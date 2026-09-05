import type { Metadata } from "next";

import { CtaSection } from "@/components/marketing/cta-section";
import { Faq } from "@/components/marketing/faq";
import { HabitBuilding } from "@/components/marketing/habit-building";
import { HumanDifference } from "@/components/marketing/human-difference";
import { ParentRelief } from "@/components/marketing/parent-relief";
import { PricingSection } from "@/components/marketing/pricing-section";
import { ProductShowcase } from "@/components/marketing/product-showcase";
import { SiteHero } from "@/components/marketing/site-hero";
import { StudyHall365 } from "@/components/marketing/study-hall-365";
import { StudyHallHourSection } from "@/components/marketing/study-hall-hour-section";
import { StudyHallMethod } from "@/components/marketing/study-hall-method";
import { TrustSafety } from "@/components/marketing/trust-safety";
import { WhyStudyHall } from "@/components/marketing/why-african-tutors";
import { getCurrentUser } from "@/lib/auth";
import { FAQ_ITEMS } from "@/lib/faq";
import { getGuideApplicantInfo } from "@/lib/guide-applicant";
import { FREE_TRIAL_CTA } from "@/lib/pricing";
import { DASHBOARD_PATH_BY_ROLE } from "@/lib/roles";

export const metadata: Metadata = {
  title: "Make Studying a Habit",
  description:
    "Live online Study Hall that helps children build a consistent academic routine — one dedicated hour with a real human Guide. First 60 minutes free.",
  alternates: { canonical: "/" },
};

const HOME_FAQ = FAQ_ITEMS.filter((f) =>
  [
    "What is Study Hall (at home)?",
    "Is this tutoring?",
    "What if my child doesn’t have homework?",
    "Does my child need to be struggling in school?",
    "Do I have to book a Study Hall every day?",
    "Do I have to book at the same time every day?",
    "What does the Guide actually do?",
    "Are sessions recorded?",
    "What if my child needs me during Study Hall?",
    "Can siblings join the same Study Hall?",
    "How does the free first session work?",
  ].includes(f.q),
);

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
    <div className="mkt-atmosphere">
      <SiteHero primaryHref={primary.href} primaryLabel={primary.label} />
      <WhyStudyHall />
      <StudyHallHourSection />
      <StudyHallMethod compact />
      <ParentRelief />
      <HabitBuilding />
      <StudyHall365 />
      <PricingSection compact ctaHref={primary.href} ctaLabel={primary.label} />
      <HumanDifference />
      <TrustSafety />
      <ProductShowcase />
      <Faq id="faq" eyebrow="FAQ" title="What parents usually ask." items={HOME_FAQ} />
      <CtaSection
        title="Start the habit with one free hour."
        description="One dedicated hour. A real human Guide. A consistent academic routine."
        primaryHref={primary.href}
        primaryLabel={primary.label}
        secondaryHref="/the-study-hall-hour"
        secondaryLabel="The Study Hall Hour"
        showFinePrint={false}
      />
    </div>
  );
}
