import type { Metadata } from "next";

import { Audiences } from "@/components/marketing/audiences";
import { CtaSection } from "@/components/marketing/cta-section";
import { Faq } from "@/components/marketing/faq";
import { FreeTrialSection } from "@/components/marketing/free-trial-section";
import { PricingSection } from "@/components/marketing/pricing-section";
import { SiteHero } from "@/components/marketing/site-hero";
import { Steps } from "@/components/marketing/steps";
import { SubjectsSection } from "@/components/marketing/subjects-section";
import { TalentStory } from "@/components/marketing/talent-story";
import { TrustRow } from "@/components/marketing/trust-row";
import { TrustSafety } from "@/components/marketing/trust-safety";
import { WhyAfricanTutors } from "@/components/marketing/why-african-tutors";
import { getCurrentUser } from "@/lib/auth";
import { FAQ_ITEMS } from "@/lib/faq";
import { getPublicPackages, getPublicSubjects, hourlyPriceRange } from "@/lib/marketing";
import { DASHBOARD_PATH_BY_ROLE } from "@/lib/roles";

export const metadata: Metadata = {
  title: "High-Quality Online Tutoring, Without the High Price",
  description:
    "Work one-on-one with carefully approved tutors from Africa — live, online, from home. Your first 30-minute session is free, no credit card required. From $17/hour.",
  alternates: { canonical: "/" },
};

export default async function HomePage() {
  const [user, subjects, packages] = await Promise.all([
    getCurrentUser(),
    getPublicSubjects(),
    getPublicPackages(),
  ]);

  const { lowCents, highCents } = hourlyPriceRange(packages);

  const primary = user
    ? user.role === "student"
      ? { href: "/dashboard/student/book", label: "Book a session" }
      : { href: DASHBOARD_PATH_BY_ROLE[user.role], label: "Go to dashboard" }
    : { href: "/signup", label: "Start free session" };

  const trialHref = user?.role === "student" ? "/dashboard/student/book" : user ? primary.href : "/signup";

  return (
    <>
      <SiteHero
        primaryHref={primary.href}
        primaryLabel={primary.label}
        hourlyLowUsd={Math.round(lowCents / 100)}
        hourlyHighUsd={Math.round(highCents / 100)}
      />

      <TrustRow />

      <Steps
        eyebrow="How It Works"
        title="From sign up to your first session in minutes."
        steps={[
          { title: "Create your account", description: "Add yourself or your child and choose the subject you need help with. No credit card required." },
          { title: "Book a session", description: "Choose an available time that works for you and we match an approved tutor." },
          { title: "Meet your tutor online", description: "Join your private, live one-on-one session directly through African Tutors." },
          { title: "Keep learning", description: "Book individual sessions or save with prepaid tutoring hours that never expire." },
        ]}
      />

      <WhyAfricanTutors />

      <TalentStory />

      <PricingSection packages={packages} />

      <FreeTrialSection ctaHref={trialHref} ctaLabel="Book my free session" />

      <SubjectsSection categories={subjects} />

      <Audiences />

      <TrustSafety />

      <Faq items={FAQ_ITEMS.slice(0, 6)} title="Frequently asked questions" />

      <CtaSection
        title="Ready to get started?"
        description="Create a free account and book your first 30-minute session, on us. No credit card required."
        primaryHref={primary.href}
        primaryLabel={primary.label}
        secondaryHref="/how-it-works"
        secondaryLabel="See how it works"
      />
    </>
  );
}
