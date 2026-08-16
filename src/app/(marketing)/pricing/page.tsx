import type { Metadata } from "next";

import { CtaSection } from "@/components/marketing/cta-section";
import { PageHeader } from "@/components/marketing/page-header";
import { PriceHighlight } from "@/components/marketing/price-highlight";
import { Container } from "@/components/ui/container";
import { HOURLY_RATE } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Pricing",
  description: `Live one-on-one online tutoring for ${HOURLY_RATE} an hour. Simple, transparent pricing.`,
};

const details = [
  {
    title: "Pay per session",
    description: "Sessions are billed individually, so you only pay for the tutoring your student books.",
  },
  {
    title: "One transparent price",
    description: `Every one-on-one session is ${HOURLY_RATE} an hour, whatever the subject.`,
  },
  {
    title: "Payments stay on platform",
    description: "All payments are processed securely through African Tutors \u2014 nothing to arrange separately.",
  },
];

export default function PricingPage() {
  return (
    <>
      <PageHeader
        eyebrow="Pricing"
        title="Real tutoring. One on one. Just $19.50 an hour."
        description="One straightforward price for live, one-on-one tutoring."
      />

      <PriceHighlight eyebrow="African Tutors" title="One student. One tutor. One hour." />

      <Container className="py-4 pb-20">
        <div className="grid gap-6 sm:grid-cols-3">
          {details.map((detail) => (
            <div key={detail.title} className="rounded-2xl border border-ink-100 bg-white p-6">
              <h3 className="text-base font-semibold text-ink-900">{detail.title}</h3>
              <p className="mt-2 text-sm leading-6 text-ink-500">{detail.description}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 rounded-2xl border border-ink-100 bg-ink-50/60 p-6 sm:p-8">
          <p className="text-sm leading-6 text-ink-600">
            Questions about pricing or getting your student started? Reach out via the{" "}
            <a href="/contact" className="font-medium text-gold-700 underline">
              contact page
            </a>{" "}
            and our team will help.
          </p>
        </div>
      </Container>

      <CtaSection
        title="Ready to book your student's first session?"
        description="Create a free account to get started \u2014 it only takes a minute."
      />
    </>
  );
}
