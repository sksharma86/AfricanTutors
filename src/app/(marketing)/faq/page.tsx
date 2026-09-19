import type { Metadata } from "next";

import { FaqCta, FaqHero, FaqList } from "@/components/marketing/faq/page-sections";
import { HomeHeaderScroll } from "@/components/marketing/home/header-scroll";
import { FAQ_ITEMS } from "@/lib/faq";
import { getGalaxyPublicCta } from "@/lib/galaxy-public-cta";

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

export default async function FaqPage() {
  const primary = await getGalaxyPublicCta();

  return (
    <div className="sh-home sh-galaxy sh-faq">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <HomeHeaderScroll />
      <FaqHero />
      <FaqList items={FAQ_ITEMS} />
      <FaqCta primaryHref={primary.href} primaryLabel={primary.label} />
    </div>
  );
}
