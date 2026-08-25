import Link from "next/link";

import { HeroProductVisual } from "@/components/marketing/product-visuals";
import { TrackCta } from "@/components/marketing/track-cta";
import { Container } from "@/components/ui/container";
import { AS_LOW_AS_LABEL, FREE_TRIAL_CTA } from "@/lib/pricing";

export function SiteHero({
  primaryHref,
  primaryLabel = FREE_TRIAL_CTA,
}: {
  primaryHref: string;
  primaryLabel?: string;
  /** @deprecated retained for call-site compatibility */
  hourlyLowUsd?: number;
  hourlyHighUsd?: number;
}) {
  return (
    <section className="relative overflow-hidden border-b border-ink-100 bg-white">
      <Container
        size="wide"
        className="grid items-center gap-10 py-12 sm:gap-12 sm:py-16 lg:grid-cols-[1fr_1fr] lg:gap-14 lg:py-20"
      >
        <div className="max-w-[34rem]">
          <p className="mkt-eyebrow at-fade-in">Live online Study Hall</p>
          <h1 className="mkt-display at-fade-in at-delay-1 mt-3 text-[2.35rem] leading-[1.08] text-ink-900 sm:text-[3rem] lg:text-[3.25rem] lg:leading-[1.05]">
            Homework gets done.
            <span className="mt-1.5 block text-ink-400">You get your evening back.</span>
          </h1>
          <p className="at-fade-in at-delay-2 mt-5 max-w-[30rem] text-[16px] leading-7 text-ink-500">
            A highly vetted Guide stays with your child on video while they do their own homework.
            Less hovering. A calmer night.
          </p>
          <div className="at-fade-in at-delay-3 mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <TrackCta href={primaryHref} cta={primaryLabel} location="hero" variant="primary" size="lg">
              {primaryLabel}
            </TrackCta>
            <Link
              href="/how-it-works"
              className="inline-flex min-h-11 items-center text-[15px] font-medium text-ink-500 transition-colors hover:text-ink-900"
            >
              See how it works
            </Link>
          </div>
          <p className="at-fade-in at-delay-3 mt-5 text-[13px] leading-5 text-ink-400">
            First 60 minutes free · No credit card required · {AS_LOW_AS_LABEL}
          </p>
        </div>

        <HeroProductVisual />
      </Container>
    </section>
  );
}
