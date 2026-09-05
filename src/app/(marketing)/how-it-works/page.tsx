import type { Metadata } from "next";
import Link from "next/link";

import { CtaSection } from "@/components/marketing/cta-section";
import { HowItWorksJourney } from "@/components/marketing/how-it-works-journey";
import { PageHeader } from "@/components/marketing/page-header";
import { Container } from "@/components/ui/container";
import { HOW_IT_WORKS_HOUSEHOLD } from "@/lib/household-pricing-copy.mjs";
import { PUBLIC_OFFER_CTA_HREF, START_FREE_CTA } from "@/lib/public-offers";

export const metadata: Metadata = {
  title: "How it works",
  description: "Choose a time, join a 60-minute Study Hall, then plan, focus, and finish — with a report after.",
  alternates: { canonical: "/how-it-works" },
};

export default function HowItWorksPage() {
  return (
    <div className="mkt-atmosphere">
      <PageHeader
        title="Choose a time. Join. Do the hour."
        description="A 60-minute Study Hall with a live Guide. Then a report, a recording, and the option to come back."
      />
      <HowItWorksJourney />
      <Container size="wide" className="pb-16 sm:pb-20">
        <div className="max-w-xl border-t border-ink-100 pt-12">
          <h2 className="mkt-display text-2xl text-ink-900">One price for the household</h2>
          <p className="mt-3 text-[16px] leading-7 text-ink-500">{HOW_IT_WORKS_HOUSEHOLD}</p>
          <p className="mt-8 text-sm text-ink-400">
            Want to become a Guide?{" "}
            <Link href="/guides/apply" className="font-medium text-ink-700 underline-offset-4 hover:underline">
              Apply here
            </Link>
            .
          </p>
        </div>
      </Container>
      <CtaSection
        title="Start with one free hour."
        description="No credit card required."
        primaryHref={PUBLIC_OFFER_CTA_HREF}
        primaryLabel={START_FREE_CTA}
        secondaryHref="/the-study-hall-hour"
        secondaryLabel="The Study Hall Hour"
        showFinePrint={false}
      />
    </div>
  );
}
