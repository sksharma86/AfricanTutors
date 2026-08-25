import Link from "next/link";

import { TrackCta } from "@/components/marketing/track-cta";
import { Container } from "@/components/ui/container";
import type { PublicPackage } from "@/lib/marketing";
import { packageBadge } from "@/lib/packages.mjs";
import { FREE_TRIAL_CTA, PAYG_PRICE_USD, formatCents, formatUsd } from "@/lib/pricing";

function packageBlurb(minutes: number, featured: boolean): string {
  if (minutes === 840 || featured) {
    return "Use your hours whenever your family needs them. Hours never expire.";
  }
  return "More hours, more savings, with the same flexibility. Hours never expire.";
}

/**
 * Compact editorial pricing — free + PAYG + two routines as a single composition,
 * not a SaaS three-card grid.
 */
export function PricingSection({
  packages,
  withHeader = true,
  ctaHref = "/signup",
}: {
  packages: PublicPackage[];
  withHeader?: boolean;
  ctaHref?: string;
}) {
  const sorted = [...packages].sort((a, b) => a.minutes - b.minutes);

  return (
    <section id="pricing" className="scroll-mt-24 py-24 sm:py-32">
      <Container size="wide">
        {withHeader ? (
          <div className="max-w-2xl">
            <p className="mkt-eyebrow">Pricing</p>
            <h2 className="mkt-display mt-4 text-4xl text-ink-900 sm:text-5xl">
              Starts at {formatUsd(PAYG_PRICE_USD)}/hour.
              <span className="block text-ink-700">Your first hour is free.</span>
            </h2>
            <p className="mt-5 max-w-xl text-base leading-7 text-ink-500">
              Pay as you go, or save with prepaid Study Hall hours that never expire.
            </p>
          </div>
        ) : null}

        <div className={`${withHeader ? "mt-14" : "mt-2"} space-y-0 divide-y divide-ink-100 border-y border-ink-100`}>
          {/* Free */}
          <div className="grid gap-4 py-8 sm:grid-cols-[1fr_auto] sm:items-baseline sm:gap-8">
            <div>
              <p className="text-sm font-semibold tracking-[-0.01em] text-forest-700">Free for eligible new families</p>
              <p className="mt-1 text-xl font-semibold tracking-[-0.02em] text-ink-900 sm:text-2xl">
                One 60-minute Study Hall
              </p>
              <p className="mt-2 max-w-lg text-[15px] leading-7 text-ink-500">
                A real live session with a highly vetted Guide. No credit card required.
              </p>
            </div>
            <p className="font-display text-4xl font-medium tracking-[-0.03em] text-ink-900 sm:text-5xl">$0</p>
          </div>

          {/* PAYG */}
          <div className="grid gap-4 py-8 sm:grid-cols-[1fr_auto] sm:items-baseline sm:gap-8">
            <div>
              <p className="text-sm font-medium text-ink-500">Pay as you go</p>
              <p className="mt-1 text-xl font-semibold tracking-[-0.02em] text-ink-900 sm:text-2xl">
                {formatUsd(PAYG_PRICE_USD)}/hour
              </p>
              <p className="mt-2 max-w-lg text-[15px] leading-7 text-ink-500">
                Book a 60-minute Study Hall whenever you need it.
              </p>
            </div>
            <p className="font-display text-4xl font-medium tracking-[-0.03em] text-ink-900 sm:text-5xl">
              {formatUsd(PAYG_PRICE_USD)}
            </p>
          </div>

          {/* Prepaid routines */}
          {sorted.map((pkg) => {
            const badge = packageBadge(pkg.minutes);
            const featured = badge === "MOST POPULAR";
            return (
              <div
                key={pkg.id}
                className="grid gap-4 py-8 sm:grid-cols-[1fr_auto] sm:items-baseline sm:gap-8"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="text-sm font-medium text-ink-500">{pkg.name}</p>
                    {badge ? (
                      <span className="text-[11px] font-semibold tracking-[0.08em] text-forest-700 uppercase">
                        {badge === "MOST POPULAR" ? "Most popular" : "Best value"}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xl font-semibold tracking-[-0.02em] text-ink-900 sm:text-2xl">
                    {formatCents(pkg.effectiveHourlyCents)}/hour effective
                    <span className="ml-2 text-base font-normal text-ink-400">
                      · {Number.isInteger(pkg.hours) ? `${pkg.hours} hours` : `${pkg.hours.toFixed(1)} hours`}
                    </span>
                  </p>
                  <p className="mt-2 max-w-lg text-[15px] leading-7 text-ink-500">
                    {packageBlurb(pkg.minutes, featured)}
                  </p>
                  {pkg.savingsCents > 0 ? (
                    <p className="mt-3 text-sm font-medium text-forest-700">
                      Save {formatCents(pkg.savingsCents)} vs. {formatUsd(PAYG_PRICE_USD)}/hour
                    </p>
                  ) : null}
                </div>
                <p className="font-display text-4xl font-medium tracking-[-0.03em] text-ink-900 sm:text-5xl">
                  {formatCents(pkg.priceCents)}
                </p>
              </div>
            );
          })}
        </div>

        <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-ink-500">
            Prepaid hours never expire.{" "}
            <Link href="/faq" className="font-medium text-ink-700 underline-offset-4 hover:underline">
              Pricing questions
            </Link>
          </p>
          <TrackCta href={ctaHref} cta={FREE_TRIAL_CTA} location="pricing" variant="primary" size="lg">
            {FREE_TRIAL_CTA}
          </TrackCta>
        </div>
      </Container>
    </section>
  );
}
