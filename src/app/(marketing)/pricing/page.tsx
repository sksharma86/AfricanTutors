import type { Metadata } from "next";

import { CtaSection } from "@/components/marketing/cta-section";
import { Faq } from "@/components/marketing/faq";
import { PageHeader } from "@/components/marketing/page-header";
import { PricingSection } from "@/components/marketing/pricing-section";
import { getCurrentUser } from "@/lib/auth";
import { FAQ_ITEMS } from "@/lib/faq";
import { getGuideApplicantInfo } from "@/lib/guide-applicant";
import { PUBLIC_OFFER_CTA_HREF, START_FREE_CTA } from "@/lib/public-offers";
import { DASHBOARD_PATH_BY_ROLE } from "@/lib/roles";

export const metadata: Metadata = {
  title: "Pricing",
  description: "First Study Hall free. Then pay as you go, 10 Study Halls, or Study Hall 365.",
  alternates: { canonical: "/pricing" },
};

export default async function PricingPage() {
  const user = await getCurrentUser();
  const applicant = user?.role === "student" ? await getGuideApplicantInfo(user.id) : null;

  const cta = !user
    ? { href: PUBLIC_OFFER_CTA_HREF, label: START_FREE_CTA }
    : applicant
      ? { href: "/dashboard/applicant", label: "View application status" }
      : user.role === "student"
        ? { href: "/dashboard/student/book", label: "Book a Study Hall" }
        : { href: DASHBOARD_PATH_BY_ROLE[user.role], label: "Go to dashboard" };

  return (
    <div className="mkt-atmosphere">
      <PageHeader
        title="Try it. Then choose what fits."
        description="The first Study Hall is free. Study Hall 365 is the flagship. No purchase buttons here — start with the free hour."
      />
      <PricingSection withHeader={false} ctaHref={cta.href} ctaLabel={cta.label} />
      <Faq
        eyebrow=""
        title="Pricing questions"
        items={FAQ_ITEMS.filter((item) =>
          [
            "How much does it cost?",
            "How does the first free Study Hall work?",
            "Can siblings join the same Study Hall?",
            "Do prepaid Study Halls expire?",
            "Can I cancel?",
          ].includes(item.q),
        )}
      />
      <CtaSection
        title="Start with one free hour."
        description="No credit card required."
        primaryHref={cta.href}
        primaryLabel={cta.label}
        showFinePrint={false}
      />
    </div>
  );
}
