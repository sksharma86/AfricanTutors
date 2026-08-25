import type { Metadata } from "next";

import { CtaSection } from "@/components/marketing/cta-section";
import { Faq } from "@/components/marketing/faq";
import { PageHeader } from "@/components/marketing/page-header";
import { PricingSection } from "@/components/marketing/pricing-section";
import { Container } from "@/components/ui/container";
import { FAQ_ITEMS } from "@/lib/faq";
import { getPublicPackages } from "@/lib/marketing";
import { FREE_TRIAL_CTA } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Simple Study Hall pricing: your first session is free, then $12/hour pay as you go — or save with 14-hour and 28-hour prepaid routines that never expire.",
  alternates: { canonical: "/pricing" },
};

export default async function PricingPage() {
  const packages = await getPublicPackages();

  return (
    <div className="mkt-atmosphere">
      <PageHeader
        eyebrow="Pricing"
        title="Simple pricing. Your first hour is free."
        description="Try a real Study Hall with a highly vetted Guide — no credit card. After that, pay $12/hour as you go, or save with prepaid hours that never expire."
      />

      <PricingSection packages={packages} withHeader={false} />

      <Container size="wide" className="pb-8">
        <p className="max-w-2xl text-[15px] leading-7 text-ink-500">
          The 14 Hour Routine is designed for a consistent Study Hall habit. The 28 Hour Routine offers
          more hours at a lower effective rate. In both cases, hours stay on your account until you use
          them.
        </p>
      </Container>

      <Faq
        eyebrow="Pricing FAQ"
        title="Pricing questions"
        items={FAQ_ITEMS.filter((f) =>
          [
            "How much does it cost?",
            "Is the first session really free?",
            "Do prepaid hours expire?",
            "What happens if I cancel?",
          ].includes(f.q),
        )}
      />

      <CtaSection
        title="See the difference a Study Hall routine makes."
        description="Create a free account and book your first session, on us."
        primaryLabel={FREE_TRIAL_CTA}
      />
    </div>
  );
}
