import Link from "next/link";

import { TrackCta } from "@/components/marketing/track-cta";
import { Container } from "@/components/ui/container";
import type { PublicPackage } from "@/lib/marketing";
import { packageBadge } from "@/lib/packages.mjs";
import {
  FAMILY_VALUE_BODY,
  FAMILY_VALUE_EYEBROW,
  FAMILY_VALUE_MATH,
  FAMILY_VALUE_RATE,
  FREE_STUDY_HALL_HOUSEHOLD,
} from "@/lib/household-pricing-copy.mjs";
import {
  AS_LOW_AS_LABEL,
  FREE_TRIAL_CTA,
  PAYG_PRICE_USD,
  formatCents,
  formatUsd,
} from "@/lib/pricing";

/**
 * Acquisition offer first, then three paid choices.
 * Values come from existing pricing / package catalog — presentation only.
 */
export function PricingSection({
  packages,
  withHeader = true,
  compact = false,
  ctaHref = "/signup",
  ctaLabel = FREE_TRIAL_CTA,
}: {
  packages: PublicPackage[];
  withHeader?: boolean;
  /** Homepage-only: tighten dead space into adjacent sections. */
  compact?: boolean;
  ctaHref?: string;
  ctaLabel?: string;
}) {
  const sorted = [...packages].sort((a, b) => a.minutes - b.minutes);

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
              {AS_LOW_AS_LABEL}.
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

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[22px] bg-white px-5 py-6 ring-1 ring-ink-900/[0.05]">
              <p className="text-[11px] font-semibold tracking-[0.14em] text-ink-400 uppercase">
                Pay as you go
              </p>
              <p className="mt-3 font-display text-3xl font-semibold tracking-[-0.03em] text-ink-900">
                {formatUsd(PAYG_PRICE_USD)}/hour
              </p>
              <p className="mt-2 text-sm text-ink-500">For occasional evenings</p>
            </div>

            {sorted.map((pkg) => {
              const badge = packageBadge(pkg.minutes);
              const featured = badge === "MOST POPULAR";
              return (
                <div
                  key={pkg.id}
                  className={
                    featured
                      ? "rounded-[22px] bg-ink-900 px-5 py-6 text-white"
                      : "rounded-[22px] bg-white px-5 py-6 ring-1 ring-ink-900/[0.05]"
                  }
                >
                  <div className="flex items-center justify-between gap-2">
                    <p
                      className={`text-[11px] font-semibold tracking-[0.14em] uppercase ${
                        featured ? "text-gold-300" : "text-ink-400"
                      }`}
                    >
                      {pkg.name}
                    </p>
                    {badge ? (
                      <span
                        className={`text-[10px] font-semibold tracking-[0.08em] uppercase ${
                          featured ? "text-gold-300" : "text-ink-500"
                        }`}
                      >
                        {badge === "MOST POPULAR" ? "Most popular" : "Best value"}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-3 font-display text-3xl font-semibold tracking-[-0.03em]">
                    {formatCents(pkg.priceCents)}
                  </p>
                  <p className={`mt-1 text-sm ${featured ? "text-white/70" : "text-ink-500"}`}>
                    {formatCents(pkg.effectiveHourlyCents)}/hour
                  </p>
                  {pkg.savingsCents > 0 ? (
                    <p className={`mt-3 text-sm font-medium ${featured ? "text-gold-300" : "text-ink-700"}`}>
                      Save {formatCents(pkg.savingsCents)}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-6 rounded-[22px] bg-white px-5 py-6 ring-1 ring-ink-900/[0.06] sm:px-8">
          <p className="text-[11px] font-semibold tracking-[0.14em] text-gold-700 uppercase">
            {FAMILY_VALUE_EYEBROW}
          </p>
          <p className="mt-3 text-[15px] leading-7 text-ink-700">{FAMILY_VALUE_BODY}</p>
          <ul className="mt-4 space-y-1.5 text-sm leading-6 text-ink-600">
            {FAMILY_VALUE_MATH.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p className="mt-4 text-[15px] leading-7 text-ink-700">{FAMILY_VALUE_RATE}</p>
        </div>

        <p className="mt-8 text-sm text-ink-500">
          Prepaid hours never expire.{" "}
          <Link href="/faq" className="font-medium text-ink-800 underline-offset-4 hover:underline">
            Pricing questions
          </Link>
        </p>
      </Container>
    </section>
  );
}
