import Link from "next/link";

import { HeroProductVisual } from "@/components/marketing/product-visuals";
import { TrackCta } from "@/components/marketing/track-cta";
import { Container } from "@/components/ui/container";
import { AS_LOW_AS_LABEL, FREE_TRIAL_CTA, NO_CARD_REQUIRED } from "@/lib/pricing";

/**
 * Product-first hero — modern sans, high contrast, live UI storytelling.
 * No lifestyle photo wash, no fake pricing widget, no oversized serif.
 */
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
    <section className="relative overflow-hidden border-b border-ink-100/80 bg-white">
      <Container size="wide" className="grid items-center gap-12 py-16 sm:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:py-24">
        <div className="max-w-xl">
          <p className="mkt-eyebrow at-fade-in">Live online Study Hall</p>
          <h1 className="mkt-display at-fade-in at-delay-1 mt-4 text-[2.5rem] text-ink-900 sm:text-5xl lg:text-[3.5rem]">
            Homework gets done.
            <span className="mt-1 block text-ink-500">You get your evening back.</span>
          </h1>
          <p className="mkt-lede at-fade-in at-delay-2 mt-5 text-ink-600">
            A highly vetted Guide stays with your child on video — keeping them focused while they do
            their own homework. Less hovering. Fewer reminders. A calmer night.
          </p>
          <div className="at-fade-in at-delay-3 mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <TrackCta href={primaryHref} cta={primaryLabel} location="hero" variant="primary" size="lg">
              {primaryLabel}
            </TrackCta>
            <Link
              href="/how-it-works"
              className="inline-flex min-h-12 items-center px-1 text-[15px] font-medium text-ink-600 transition-colors hover:text-ink-900"
            >
              See how it works
            </Link>
          </div>
          <p className="at-fade-in at-delay-3 mt-5 text-sm text-ink-500">
            First 60 minutes free. {NO_CARD_REQUIRED} {AS_LOW_AS_LABEL}.
          </p>
        </div>

        <div className="relative">
          <div
            className="pointer-events-none absolute -inset-8 -z-10 rounded-[40px] bg-[radial-gradient(circle_at_50%_40%,rgba(201,136,22,0.08),transparent_60%)]"
            aria-hidden
          />
          <HeroProductVisual />
        </div>
      </Container>
    </section>
  );
}
