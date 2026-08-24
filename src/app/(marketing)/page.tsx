import type { Metadata } from "next";

import { Audiences } from "@/components/marketing/audiences";
import { CtaSection } from "@/components/marketing/cta-section";
import { Faq } from "@/components/marketing/faq";
import { FreeTrialSection } from "@/components/marketing/free-trial-section";
import { PricingSection } from "@/components/marketing/pricing-section";
import { SiteHero } from "@/components/marketing/site-hero";
import { Steps } from "@/components/marketing/steps";
import { TrustRow } from "@/components/marketing/trust-row";
import { TrustSafety } from "@/components/marketing/trust-safety";
import { WhyAfricanTutors } from "@/components/marketing/why-african-tutors";
import { getCurrentUser } from "@/lib/auth";
import { FAQ_ITEMS } from "@/lib/faq";
import { getPublicPackages, hourlyPriceRange } from "@/lib/marketing";
import { DASHBOARD_PATH_BY_ROLE } from "@/lib/roles";

export const metadata: Metadata = {
  title: "Affordable Live Homework Supervision for Families",
  description:
    "Study Hall at Home gives families affordable live homework supervision. A trained Guide keeps your children on task by video while they do their schoolwork. Your first session is free, no credit card required.",
  alternates: { canonical: "/" },
};

export default async function HomePage() {
  const [user, packages] = await Promise.all([getCurrentUser(), getPublicPackages()]);

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
        title="From sign up to your first Study Hall in minutes."
        steps={[
          { title: "Create your account", description: "Add your child (or children) to your parent account. No credit card required." },
          { title: "Book a Study Hall", description: "Choose a time that works for your family and we match an available Guide." },
          { title: "Meet your Guide online", description: "Your child joins a live, supervised Study Hall and gets to work — the Guide keeps them on task." },
          { title: "Build a routine", description: "Book sessions as you need them, or save with prepaid hours." },
        ]}
      />

      <WhyAfricanTutors />

      <PricingSection packages={packages} />

      <FreeTrialSection ctaHref={trialHref} ctaLabel="Book my free session" />

      <Audiences />

      <TrustSafety />

      <Faq items={FAQ_ITEMS.slice(0, 6)} title="Frequently asked questions" />

      <CtaSection
        title="Ready to get started?"
        description="Create a free account and book your first Study Hall session, on us. No credit card required."
        primaryHref={primary.href}
        primaryLabel={primary.label}
        secondaryHref="/how-it-works"
        secondaryLabel="See how it works"
      />
    </>
  );
}
