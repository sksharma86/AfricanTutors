import type { Metadata } from "next";

import { CtaSection } from "@/components/marketing/cta-section";
import { Faq } from "@/components/marketing/faq";
import { PageHeader } from "@/components/marketing/page-header";
import { FAQ_ITEMS } from "@/lib/faq";

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Answers about African Tutors: how it works, who the tutors are, pricing, the free trial, recorded sessions, booking for multiple children, cancellations, and more.",
  alternates: { canonical: "/faq" },
};

// Structured data (FAQPage) — accurate, sourced from the same FAQ content.
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
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <PageHeader
        eyebrow="FAQ"
        title="Questions, answered."
        description="Everything you need to know before your first session. Still have a question? Contact us anytime."
      />
      <Faq eyebrow="Common questions" title="Frequently asked questions" />
      <CtaSection
        title="Ready to try it?"
        description="Your first 30-minute session is free — no credit card required."
      />
    </>
  );
}
