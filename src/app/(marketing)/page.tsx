import type { Metadata } from "next";

import { CtaSection } from "@/components/marketing/cta-section";
import { Faq } from "@/components/marketing/faq";
import { HourChapter } from "@/components/marketing/hour-chapter";
import { MethodChapter } from "@/components/marketing/method-chapter";
import { PricingSection } from "@/components/marketing/pricing-section";
import { Routine365 } from "@/components/marketing/routine-365";
import { SiteHero } from "@/components/marketing/site-hero";
import { TrustSafety } from "@/components/marketing/trust-safety";
import { WhyStudyHall } from "@/components/marketing/why-african-tutors";
import { getCurrentUser } from "@/lib/auth";
import { FAQ_ITEMS } from "@/lib/faq";
import { getGuideApplicantInfo } from "@/lib/guide-applicant";
import { START_FREE_CTA } from "@/lib/public-offers";
import { DASHBOARD_PATH_BY_ROLE } from "@/lib/roles";

export const metadata: Metadata = {
  title: "Make Studying a Habit",
  description:
    "A focused hour with a real human Guide to help your child show up, stay on task, and get the work done. First Study Hall free.",
  alternates: { canonical: "/" },
};

const HOME_FAQ = FAQ_ITEMS.filter((f) =>
  [
    "What is Study Hall (at home)?",
    "Is this tutoring?",
    "What if my child doesn’t have homework?",
    "Does my child need to be struggling in school?",
    "Do I have to use Study Hall every day?",
    "Can siblings join the same Study Hall?",
    "Are sessions recorded?",
    "How does the first free Study Hall work?",
  ].includes(f.q),
);

export default async function HomePage() {
  const user = await getCurrentUser();
  const applicant = user?.role === "student" ? await getGuideApplicantInfo(user.id) : null;

  const primary = !user
    ? { href: "/signup", label: START_FREE_CTA }
    : applicant
      ? { href: "/dashboard/applicant", label: "View application status" }
      : user.role === "student"
        ? { href: "/dashboard/student/book", label: "Book a Study Hall" }
        : { href: DASHBOARD_PATH_BY_ROLE[user.role], label: "Go to dashboard" };

  return (
    <div className="mkt-atmosphere">
      <SiteHero primaryHref={primary.href} primaryLabel={primary.label} />
      <HourChapter />
      <MethodChapter />
      <WhyStudyHall />
      <Routine365 />
      <TrustSafety />
      <PricingSection compact ctaHref={primary.href} ctaLabel={primary.label} />
      <Faq id="faq" eyebrow="" title="Questions" items={HOME_FAQ} />
      <CtaSection
        title="Start with one free hour."
        description="No credit card required."
        primaryHref={primary.href}
        primaryLabel={primary.label}
        showFinePrint={false}
      />
    </div>
  );
}
