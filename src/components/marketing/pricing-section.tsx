import Link from "next/link";

import { TrackCta } from "@/components/marketing/track-cta";
import { Container } from "@/components/ui/container";
import { FREE_STUDY_HALL_HOUSEHOLD } from "@/lib/household-pricing-copy.mjs";
import type { PublicPackage } from "@/lib/marketing";
import { PUBLIC_OFFERS, PUBLIC_OFFER_CTA_HREF } from "@/lib/public-offers";
import { FREE_TRIAL_CTA } from "@/lib/pricing";

/**
 * Public offer ladder. Presentation only.
 * CTAs stay on the existing free-first-Study-Hall signup path.
 * `packages` is unused — retained so older call sites compile until PR 2.
 */
export function PricingSection({
  withHeader = true,
  compact = false,
  ctaHref = PUBLIC_OFFER_CTA_HREF,
  ctaLabel = FREE_TRIAL_CTA,
}: {
  packages?: PublicPackage[];
  withHeader?: boolean;
  compact?: boolean;
  ctaHref?: string;
  ctaLabel?: string;
}) {
  const featured = PUBLIC_OFFERS.find((offer) => offer.featured);
  const supporting = PUBLIC_OFFERS.filter((offer) => !offer.featured);

  return (
    <section
      id="pricing"
      className={
        compact
          ? "scroll-mt-24 bg-[#f7f6f3] pb-10 pt-8 sm:pb-12 sm:pt-10"
          : "scroll-mt-24 bg-[#f7f6f3] py-16 sm:py-24"
      }
    >
      <Container size="wide">
        {withHeader ? (
          <div className="max-w-2xl">
            <p className="mkt-eyebrow">Pricing</p>
            <h2 className="mkt-display mt-3 text-3xl text-ink-900 sm:text-[2.5rem]">
              Start with one free hour.
            </h2>
          </div>
        ) : null}

        <div className={`${withHeader ? "mt-10" : "mt-2"} space-y-4`}>
          <div className="rounded-[22px] bg-white px-5 py-7 ring-1 ring-ink-900/[0.06] sm:px-8">
            <p className="text-[11px] font-semibold tracking-[0.14em] text-gold-700 uppercase">
              First Study Hall
            </p>
            <p className="mt-3 font-display text-[1.85rem] font-semibold tracking-[-0.03em] text-ink-900 sm:text-4xl">
              Your first Study Hall is on us.
            </p>
            <p className="mt-3 text-[15px] leading-7 text-ink-500">{FREE_STUDY_HALL_HOUSEHOLD}</p>
            <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
              <p className="font-display text-5xl font-semibold tracking-[-0.04em] text-ink-900">$0</p>
              <TrackCta href={ctaHref} cta={ctaLabel} location="pricing" variant="primary" size="lg">
                {ctaLabel}
              </TrackCta>
            </div>
          </div>

          {featured ? (
            <div
              data-offer={featured.id}
              className="rounded-[22px] bg-ink-900 px-5 py-8 text-white sm:px-8"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <p className="text-[11px] font-semibold tracking-[0.14em] text-gold-300 uppercase">
                  {featured.name}
                </p>
                <p className="text-[11px] font-semibold tracking-[0.08em] text-gold-300 uppercase">
                  Flagship
                </p>
              </div>
              <p className="mt-4 font-display text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
                {featured.priceLabel}
                <span className="ml-2 text-[1.05rem] font-medium tracking-[-0.02em] text-white/55">
                  {featured.unit}
                </span>
              </p>
              <p className="mt-3 text-[16px] leading-7 text-white/72">{featured.detail}</p>
              <p className="mt-2 text-[15px] leading-7 text-white/58">{featured.note}</p>
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            {supporting.map((offer) => (
              <div
                key={offer.id}
                data-offer={offer.id}
                className="rounded-[22px] bg-white px-5 py-6 ring-1 ring-ink-900/[0.05]"
              >
                <p className="text-[11px] font-semibold tracking-[0.14em] text-ink-400 uppercase">
                  {offer.name}
                </p>
                <p className="mt-3 font-display text-3xl font-semibold tracking-[-0.03em] text-ink-900">
                  {offer.priceLabel}
                </p>
                <p className="mt-1 text-sm text-ink-700">{offer.unit}</p>
                <p className="mt-1 text-sm text-ink-500">{offer.detail}</p>
                <p className="mt-3 text-sm text-ink-500">{offer.note}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-8 text-sm text-ink-500">
          À la carte Study Halls never expire.{" "}
          <Link href="/faq" className="font-medium text-ink-800 underline-offset-4 hover:underline">
            Pricing questions
          </Link>
        </p>
      </Container>
    </section>
  );
}
