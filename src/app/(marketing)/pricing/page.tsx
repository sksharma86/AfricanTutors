import type { Metadata } from "next";

import { CtaSection } from "@/components/marketing/cta-section";
import { PageHeader } from "@/components/marketing/page-header";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Simple, transparent pricing for online tutoring on African Tutors.",
};

const principles = [
  {
    title: "Pay per session",
    description: "You pay for the sessions you book. There are no long-term contracts.",
  },
  {
    title: "Transparent pricing",
    description: "The price of a session is shown clearly before you book it.",
  },
  {
    title: "Payments stay on platform",
    description: "All payments are processed securely through African Tutors.",
  },
];

export default function PricingPage() {
  return (
    <>
      <PageHeader
        eyebrow="Pricing"
        title="Straightforward pricing for one-on-one tutoring."
        description="We're finalizing exact session rates ahead of launch. Here's how pricing on African Tutors will work."
      />

      <Container className="py-16">
        <div className="grid gap-6 sm:grid-cols-3">
          {principles.map((principle) => (
            <div key={principle.title} className="rounded-2xl border border-ink-100 bg-white p-6">
              <h3 className="text-base font-semibold text-ink-900">{principle.title}</h3>
              <p className="mt-2 text-sm leading-6 text-ink-500">{principle.description}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 rounded-2xl border border-ink-100 bg-ink-50/60 p-6 sm:p-8">
          <p className="text-sm leading-6 text-ink-600">
            Detailed pricing tiers and subject-specific rates will be published here before
            checkout is enabled. In the meantime, reach out via the{" "}
            <a href="/contact" className="font-medium text-brand-600 underline">
              contact page
            </a>{" "}
            with any pricing questions.
          </p>
        </div>
      </Container>

      <CtaSection
        title="Want to be notified when pricing is live?"
        description="Create an account now and we'll let you know as soon as booking opens."
      />
    </>
  );
}
