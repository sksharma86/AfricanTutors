import type { Metadata } from "next";

import { HomeHeaderScroll } from "@/components/marketing/home/header-scroll";
import {
  WhyItWorksBenefits,
  WhyItWorksCore,
  WhyItWorksHero,
  WhyItWorksRhythm,
  WhyItWorksUnlimited,
  WhyItWorksWeek,
} from "@/components/marketing/why-it-works/page-sections";
import {
  WHY_IT_WORKS_META_DESCRIPTION,
  WHY_IT_WORKS_META_TITLE,
} from "@/lib/galaxy-1b-copy";
import { getGalaxyPublicCta } from "@/lib/galaxy-public-cta";

export const metadata: Metadata = {
  title: WHY_IT_WORKS_META_TITLE,
  description: WHY_IT_WORKS_META_DESCRIPTION,
  alternates: { canonical: "/why-it-works" },
};

export default async function WhyItWorksPage() {
  const primary = await getGalaxyPublicCta();

  return (
    <div className="sh-home sh-galaxy">
      <HomeHeaderScroll />
      <WhyItWorksHero primaryHref={primary.href} primaryLabel={primary.label} />
      <WhyItWorksCore />
      <WhyItWorksWeek />
      <WhyItWorksBenefits />
      <WhyItWorksRhythm />
      <WhyItWorksUnlimited primaryHref={primary.href} primaryLabel={primary.label} />
    </div>
  );
}
