import type { Metadata } from "next";

import { CtaSection } from "@/components/marketing/cta-section";
import { Faq } from "@/components/marketing/faq";
import { PricingSection } from "@/components/marketing/pricing-section";
import { ProductShowcase } from "@/components/marketing/product-showcase";
import { SiteHero } from "@/components/marketing/site-hero";
import { Steps } from "@/components/marketing/steps";
import { TrustRow } from "@/components/marketing/trust-row";
import { TrustSafety } from "@/components/marketing/trust-safety";
import { WhyStudyHall } from "@/components/marketing/why-african-tutors";
import { getCurrentUser } from "@/lib/auth";
import { FAQ_ITEMS } from "@/lib/faq";
import { getGuideApplicantInfo } from "@/lib/guide-applicant";
import { getPublicPackages } from "@/lib/marketing";
import { AS_LOW_AS_LABEL, FREE_TRIAL_CTA } from "@/lib/pricing";
import { DASHBOARD_PATH_BY_ROLE } from "@/lib/roles";

export const metadata: Metadata = {
  title: "Live Online Study Hall for Families",
  description: `Live online homework supervision for families. A highly vetted Guide keeps your child focused while they do their own work. First 60 minutes free. ${AS_LOW_AS_LABEL}.`,
  alternates: { canonical: "/" },
};

const HOME_FAQ = FAQ_ITEMS.filter((f) =>
  [
    "What is Study Hall (at home)?",
    "Who are the Guides?",
    "How much does it cost?",
    "Is the first session really free?",
    "What if my child needs me during Study Hall?",
    "Are sessions recorded?",
    "Do prepaid hours expire?",
  ].includes(f.q),
);

export default async function HomePage() {
  const [user, packages] = await Promise.all([getCurrentUser(), getPublicPackages()]);
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
      <TrustRow />
      <Steps />
      <ProductShowcase />
      <WhyStudyHall />
      <PricingSection packages={packages} ctaHref={primary.href} ctaLabel={primary.label} />
      <TrustSafety />
      <Faq eyebrow="FAQ" title="Quick answers." items={HOME_FAQ} />
      <CtaSection
        title="Try your first hour free."
        description="Create an account and book a real Study Hall. No credit card required."
        primaryHref={primary.href}
        primaryLabel={primary.label}
        secondaryHref="/how-it-works"
        secondaryLabel="See how it works"
      />
    </div>
  );
}
