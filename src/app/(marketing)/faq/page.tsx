import type { Metadata } from "next";

import { CtaSection } from "@/components/marketing/cta-section";
import { Faq } from "@/components/marketing/faq";
import { PageHeader } from "@/components/marketing/page-header";
import { FAQ_ITEMS } from "@/lib/faq";

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Answers about Study Hall at Home: how it works, Guides, pricing, the free session, Call Parent, recordings, and more.",
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
      <PageHeader
        eyebrow="FAQ"
        title="Questions, answered."
        description="Clear answers before your first Study Hall. Still unsure? Contact us anytime."
      />
      <Faq eyebrow="Common questions" title="Frequently asked questions" />
      <CtaSection
        title="Ready to try it?"
        description="Your first session is free — no credit card required."
      />
    </div>
  );
}
