import type { Metadata } from "next";

import { CtaSection } from "@/components/marketing/cta-section";
import { Faq } from "@/components/marketing/faq";
import { PageHeader } from "@/components/marketing/page-header";
import { FAQ_ITEMS } from "@/lib/faq";
import { PUBLIC_OFFER_CTA_HREF, START_FREE_CTA } from "@/lib/public-offers";

export const metadata: Metadata = {
  title: "FAQ",
  description: "What Study Hall is, what Guides do, recordings, siblings, and the first free hour.",
  alternates: { canonical: "/faq" },
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ_ITEMS.map((item) => ({
    "@type": "Question",
    name: item.q,
    acceptedAnswer: { "@type": "Answer", text: item.a },
  })),
};

export default function FaqPage() {
  return (
    <div className="mkt-atmosphere">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <PageHeader title="Questions, answered." description="Short answers before the first Study Hall." />
      <Faq eyebrow="" title="Frequently asked questions" />
      <CtaSection
        title="Start with one free hour."
        description="No credit card required."
        primaryHref={PUBLIC_OFFER_CTA_HREF}
        primaryLabel={START_FREE_CTA}
        showFinePrint={false}
      />
    </div>
  );
}
