import type { Metadata } from "next";

import { CtaSection } from "@/components/marketing/cta-section";
import { Faq } from "@/components/marketing/faq";
import { PageHeader } from "@/components/marketing/page-header";
import { PricingSection } from "@/components/marketing/pricing-section";
import { Container } from "@/components/ui/container";
import { FAQ_ITEMS } from "@/lib/faq";
import { getPublicPackages } from "@/lib/marketing";
import { AS_LOW_AS_LABEL, FREE_TRIAL_CTA, PAYG_PRICE_USD, formatUsd } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "Pricing",
  description: `Study Hall pricing: first session free, then ${formatUsd(PAYG_PRICE_USD)}/hour pay as you go — or save with 14-hour and 28-hour prepaid routines (${AS_LOW_AS_LABEL}). Hours never expire.`,
  alternates: { canonical: "/pricing" },
};

export default async function PricingPage() {
  const packages = await getPublicPackages();

  return (
    <div className="mkt-atmosphere">
      <PageHeader
        eyebrow="Pricing"
        title={`${AS_LOW_AS_LABEL}. First hour free.`}
        description={`Try a real Study Hall with a highly vetted Guide — no credit card. Then ${formatUsd(PAYG_PRICE_USD)}/hour as you go, or save with prepaid hours that never expire.`}
      />

      <PricingSection packages={packages} withHeader={false} />

      <Container size="wide" className="pb-6">
        <p className="max-w-2xl text-[15px] leading-7 text-ink-500">
          The 14 Hour Routine is built for a consistent habit. The 28 Hour Routine unlocks the lowest
          effective rate at $9/hour. Hours stay on your account until you use them.
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
        title="Start with a free hour."
        description="Create an account and book your first Study Hall — on us."
        primaryLabel={FREE_TRIAL_CTA}
      />
    </div>
  );
}
