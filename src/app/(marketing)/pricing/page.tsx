import type { Metadata } from "next";

import { CtaSection } from "@/components/marketing/cta-section";
import { Faq } from "@/components/marketing/faq";
import { PageHeader } from "@/components/marketing/page-header";
import { PricingSection } from "@/components/marketing/pricing-section";
import { Container } from "@/components/ui/container";
import { FAQ_ITEMS } from "@/lib/faq";
import { getPublicPackages } from "@/lib/marketing";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Simple Study Hall pricing: your first session is free, then $12/hour pay as you go — or save with 14-hour and 28-hour prepaid routines that never expire.",
  alternates: { canonical: "/pricing" },
};

const principles = [
  {
    title: "Pay as you go or prepay & save",
    description: "Book a 60-minute session for $12, or buy prepaid hours for a lower effective rate.",
  },
  {
    title: "Built for routine",
    description: "The 14 Hour Routine is designed for a consistent Study Hall habit — roughly two weeks of daily sessions.",
  },
  {
    title: "Hours never expire",
    description: "Prepaid hours stay on your account until you use them, and apply automatically when they cover a session.",
  },
];

export default async function PricingPage() {
  const packages = await getPublicPackages();

  return (
    <>
      <PageHeader
        eyebrow="Pricing"
        title="Simple pricing. Your first session is free."
        description="Try Study Hall at Home with a real session at no cost and no credit card. After that, pay $12/hour as you go — or save with prepaid routines."
      />

      <PricingSection packages={packages} withHeader={false} />

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

      <Faq
        eyebrow="Pricing FAQ"
        title="Pricing questions"
        items={FAQ_ITEMS.filter((f) =>
          ["How much does it cost?", "Is the first session really free?", "Do prepaid hours expire?", "What happens if I cancel?"].includes(f.q),
        )}
      />

      <CtaSection
        title="See the difference a Study Hall routine makes."
        description="Create a free account and book your first session, on us."
      />
    </>
  );
}
