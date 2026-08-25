import Image from "next/image";
import Link from "next/link";

import { TrackCta } from "@/components/marketing/track-cta";
import { Container } from "@/components/ui/container";
import { FREE_TRIAL_CTA, NO_CARD_REQUIRED, PAYG_PRICE_USD, formatUsd } from "@/lib/pricing";

/**
 * Full-bleed editorial hero — brand-first, one headline, one CTA group,
 * dominant photography. No fake pricing widgets, badges, or card stacks.
 */
export function SiteHero({
  primaryHref,
  primaryLabel = FREE_TRIAL_CTA,
}: {
  primaryHref: string;
  primaryLabel?: string;
  /** @deprecated retained for call-site compatibility; unused in redesign */
  hourlyLowUsd?: number;
  hourlyHighUsd?: number;
}) {
  return (
    <section className="relative isolate overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <Image
          src="/images/marketing/studyhall-hero-desk.webp"
          alt="A teenager focused on homework at a calm home desk during Study Hall"
          fill
          priority
          sizes="100vw"
          className="object-cover object-[center_35%]"
        />
        <div
          className="absolute inset-0 bg-gradient-to-b from-[#f7f4ee]/92 via-[#f7f4ee]/78 to-[#f7f4ee]"
          aria-hidden
        />
        <div
          className="absolute inset-0 bg-gradient-to-r from-[#f7f4ee]/90 via-[#f7f4ee]/55 to-transparent"
          aria-hidden
        />
      </div>

      <Container size="wide" className="flex min-h-[min(92vh,860px)] flex-col justify-end pb-16 pt-28 sm:pb-20 sm:pt-32 md:justify-center md:pb-28 md:pt-36">
        <div className="max-w-2xl">
          <p className="mkt-eyebrow at-fade-in">Study Hall at Home</p>
          <h1 className="mkt-display at-fade-in at-delay-1 mt-5 text-[2.65rem] text-ink-900 sm:text-6xl md:text-[4.25rem]">
            Live Study Hall.
            <span className="mt-1 block text-ink-800/90">Evenings, returned.</span>
          </h1>
          <p className="mkt-lede at-fade-in at-delay-2 mt-6 text-ink-600">
            A highly vetted Guide keeps your child focused and accountable by video while they do their
            own homework — so your family builds a calmer routine, and you get part of the evening back.
          </p>
          <div className="at-fade-in at-delay-3 mt-9 flex flex-col gap-4 sm:flex-row sm:items-center">
            <TrackCta href={primaryHref} cta={primaryLabel} location="hero" variant="primary" size="lg">
              {primaryLabel}
            </TrackCta>
            <Link
              href="/how-it-works"
              className="inline-flex min-h-12 items-center px-1 text-[15px] font-medium text-ink-600 transition-colors hover:text-ink-900"
            >
              How it works
              <span aria-hidden className="ml-1.5 transition-transform group-hover:translate-x-0.5">
                →
              </span>
            </Link>
          </div>
          <p className="at-fade-in at-delay-3 mt-5 text-sm text-ink-500">
            First 60 minutes free for eligible new families. {NO_CARD_REQUIRED} From{" "}
            {formatUsd(PAYG_PRICE_USD)}/hour after that.
          </p>
        </div>
      </Container>
    </section>
  );
}
