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
    "Simple, transparent pricing: your first session is free, then $12 for 30 minutes or $20 for 60 minutes. Save with prepaid hours that never expire.",
  alternates: { canonical: "/pricing" },
};

const principles = [
  {
    title: "Pay per session or prepay & save",
    description: "Book individual sessions, or buy prepaid hours for a lower rate. No subscriptions or recurring billing.",
  },
  {
    title: "Transparent pricing",
    description: "$12 for 30 minutes, $20 for 60 minutes. The exact price is shown clearly before you book.",
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
        description="Try Study Hall at Home with a real session at no cost and no credit card. After that, sessions are $12 for 30 minutes or $20 for 60 minutes — or save with prepaid hours."
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
