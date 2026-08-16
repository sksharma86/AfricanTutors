import type { Metadata } from "next";

import { CtaSection } from "@/components/marketing/cta-section";
import { PageHeader } from "@/components/marketing/page-header";
import { PricingTiers } from "@/components/marketing/pricing-tiers";
import { Container } from "@/components/ui/container";
import { FREE_TRIAL_CTA } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Simple, transparent pricing: your first 30-minute tutoring session is free, then $12 for 30 minutes or $20 for 60 minutes.",
};

const principles = [
  {
    title: "Pay per session",
    description: "You pay only for the sessions you book. No subscriptions, no packages to sign up for.",
  },
  {
    title: "Transparent pricing",
    description: "$12 for 30 minutes, $20 for 60 minutes. The price is shown clearly before you book.",
  },
  {
    title: "Payments stay on platform",
    description: "Paid sessions are processed securely through African Tutors when you're ready.",
  },
];

export default function PricingPage() {
  return (
    <>
      <PageHeader
        eyebrow="Pricing"
        title="Simple pricing. Your first session is free."
        description="Try African Tutors with a real 30-minute one-on-one tutoring session at no cost and no credit card. After that, sessions are a flat $12 for 30 minutes or $20 for 60 minutes."
      />

      <PricingTiers />

      <Container className="pb-16">
        <div className="grid gap-6 sm:grid-cols-3">
          {principles.map((principle) => (
            <div key={principle.title} className="rounded-2xl border border-ink-100 bg-white p-6">
              <h3 className="text-base font-semibold text-ink-900">{principle.title}</h3>
              <p className="mt-2 text-sm leading-6 text-ink-500">{principle.description}</p>
            </div>
          ))}
        </div>
      </Container>

      <CtaSection
        title="See the difference a real tutor makes."
        description="Create a free account and book your student's first 30-minute session, on us."
        primaryLabel={FREE_TRIAL_CTA}
      />
    </>
  );
}
