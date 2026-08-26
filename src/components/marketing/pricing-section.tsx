import Link from "next/link";

import { TrackCta } from "@/components/marketing/track-cta";
import { Container } from "@/components/ui/container";
import type { PublicPackage } from "@/lib/marketing";
import { packageBadge } from "@/lib/packages.mjs";
import {
  FREE_TRIAL_CTA,
  PAYG_PRICE_USD,
  STARTING_AT_LABEL,
  formatCents,
  formatUsd,
} from "@/lib/pricing";

function packageBlurb(minutes: number, featured: boolean): string {
  if (minutes === 840 || featured) {
    return "Use your hours whenever your family needs them. Hours never expire.";
  }
  return "More hours, more savings, same flexibility. Hours never expire.";
}

/**
 * Clear pricing composition — PAYG $12 explicit; prepaid floor $9.
 */
export function PricingSection({
  packages,
  withHeader = true,
  ctaHref = "/signup",
  ctaLabel = FREE_TRIAL_CTA,
}: {
  packages: PublicPackage[];
  withHeader?: boolean;
  ctaHref?: string;
  ctaLabel?: string;
}) {
  const sorted = [...packages].sort((a, b) => a.minutes - b.minutes);

  return (
    <section id="pricing" className="scroll-mt-24 py-16 sm:py-22">
      <Container size="wide">
        {withHeader ? (
          <div className="max-w-2xl">
            <p className="mkt-eyebrow">Pricing</p>
            <h2 className="mkt-display mt-3 text-3xl text-ink-900 sm:text-[2.6rem]">
              {STARTING_AT_LABEL}.
              <span className="mt-1 block text-ink-500">First hour free.</span>
            </h2>
            <p className="mt-4 max-w-xl text-[16px] leading-7 text-ink-500">
              Pay as you go at {formatUsd(PAYG_PRICE_USD)}/hour, or save with prepaid hours that never
              expire.
            </p>
          </div>
        ) : null}

        <div className={`${withHeader ? "mt-12" : "mt-2"} grid gap-4 lg:grid-cols-2`}>
          <div className="rounded-[22px] border border-forest-200 bg-forest-50/70 p-6 sm:p-7">
            <p className="text-sm font-semibold text-forest-800">First Study Hall</p>
            <p className="mt-2 font-display text-3xl text-ink-900">Free</p>
            <p className="mt-1 text-lg font-medium text-ink-800">One 60-minute session</p>
            <p className="mt-3 text-[15px] leading-7 text-ink-600">
              A real live session with a highly vetted Guide. No credit card required.
            </p>
          </div>
          <div className="rounded-[22px] border border-ink-100 bg-surface p-6 shadow-[var(--shadow-sm)] sm:p-7">
            <p className="text-sm font-medium text-ink-500">Pay as you go</p>
            <p className="mt-2 font-display text-3xl text-ink-900">{formatUsd(PAYG_PRICE_USD)}/hour</p>
            <p className="mt-3 text-[15px] leading-7 text-ink-500">
              Book a 1-, 2-, or 3-hour Study Hall whenever you need it.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {sorted.map((pkg) => {
            const badge = packageBadge(pkg.minutes);
            const featured = badge === "MOST POPULAR";
            return (
              <div
                key={pkg.id}
                className={`rounded-[22px] border bg-surface p-6 shadow-[var(--shadow-sm)] sm:p-7 ${
                  featured ? "border-gold-300" : "border-ink-100"
                }`}
              >
                <div className="flex flex-wrap items-center gap-2.5">
                  <p className="text-sm font-medium text-ink-500">{pkg.name}</p>
                  {badge ? (
                    <span className="rounded-full bg-gold-50 px-2 py-0.5 text-[11px] font-semibold tracking-[0.04em] text-gold-800 uppercase">
                      {badge === "MOST POPULAR" ? "Most popular" : "Best value"}
                    </span>
                  ) : null}
                </div>
                <p className="mt-3 font-display text-3xl text-ink-900">{formatCents(pkg.priceCents)}</p>
                <p className="mt-1 text-[15px] text-ink-600">
                  {formatCents(pkg.effectiveHourlyCents)}/hour
                  <span className="text-ink-400">
                    {" "}
                    · {Number.isInteger(pkg.hours) ? `${pkg.hours} hours` : `${pkg.hours.toFixed(1)} hours`}
                  </span>
                </p>
                <p className="mt-3 text-[15px] leading-7 text-ink-500">{packageBlurb(pkg.minutes, featured)}</p>
                {pkg.savingsCents > 0 ? (
                  <p className="mt-2 text-sm font-medium text-forest-700">
                    Save {formatCents(pkg.savingsCents)} vs. {formatUsd(PAYG_PRICE_USD)}/hour
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-ink-500">
            Prepaid hours never expire.{" "}
            <Link href="/faq" className="font-medium text-ink-800 underline-offset-4 hover:underline">
              Pricing questions
            </Link>
          </p>
          <TrackCta href={ctaHref} cta={ctaLabel} location="pricing" variant="primary" size="lg">
            {ctaLabel}
          </TrackCta>
        </div>
      </Container>
    </section>
  );
}
