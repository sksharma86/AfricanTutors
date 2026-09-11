import type { Metadata } from "next";

import { HomeHeaderScroll } from "@/components/marketing/home/header-scroll";
import {
  HowItWorksCta,
  HowItWorksFaq,
  HowItWorksGuide,
  HowItWorksHero,
  HowItWorksJourney,
  HowItWorksParent,
  HowItWorksTrust,
  HowItWorksWho,
} from "@/components/marketing/how-it-works/page-sections";
import {
  HOW_IT_WORKS_META_DESCRIPTION,
  HOW_IT_WORKS_META_TITLE,
} from "@/lib/galaxy-1b-copy";
import { getGalaxyPublicCta } from "@/lib/galaxy-public-cta";
import { HOW_IT_WORKS_HOUSEHOLD } from "@/lib/household-pricing-copy.mjs";

export const metadata: Metadata = {
  title: HOW_IT_WORKS_META_TITLE,
  description: HOW_IT_WORKS_META_DESCRIPTION,
  alternates: { canonical: "/how-it-works" },
};

export default async function HowItWorksPage() {
  const primary = await getGalaxyPublicCta();

  return (
    <div className="sh-home sh-galaxy">
      <HomeHeaderScroll />
      <HowItWorksHero primaryHref={primary.href} primaryLabel={primary.label} />
      <HowItWorksJourney household={HOW_IT_WORKS_HOUSEHOLD} />
      <HowItWorksGuide />
      <HowItWorksParent />
      <HowItWorksTrust />
      <HowItWorksWho />
      <HowItWorksFaq />
      <HowItWorksCta primaryHref={primary.href} primaryLabel={primary.label} />
    </div>
  );
}
