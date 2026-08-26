import Link from "next/link";

import { TrackCta } from "@/components/marketing/track-cta";
import { Container } from "@/components/ui/container";
import { FREE_TRIAL_CTA, STARTING_AT_LABEL } from "@/lib/pricing";

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
    <section className="relative overflow-hidden border-b border-ink-100/80">
      <Container size="wide" className="py-16 sm:py-20 lg:py-24">
        <div className="mx-auto max-w-[40rem] text-center">
          <p className="mkt-eyebrow at-fade-in">Study Hall (at home)</p>
          <h1 className="mkt-display at-fade-in at-delay-1 mt-4 text-[2.4rem] text-ink-900 sm:text-[3.35rem] lg:text-[3.75rem]">
            Homework gets done.
            <span className="mt-2 block text-ink-500">You get your evening back.</span>
          </h1>
          <p className="at-fade-in at-delay-2 mx-auto mt-6 max-w-[32rem] text-[17px] leading-8 text-ink-600">
            Live online homework supervision. A carefully vetted Guide stays with your child on
            video while they do their own work — so someone is actually watching, and you don&apos;t
            have to hover.
          </p>
          <div className="at-fade-in at-delay-3 mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <TrackCta href={primaryHref} cta={primaryLabel} location="hero" variant="primary" size="lg">
              {primaryLabel}
            </TrackCta>
            <Link
              href="/how-it-works"
              className="inline-flex min-h-12 items-center rounded-[14px] px-5 text-[15px] font-semibold text-ink-700 transition-colors hover:text-ink-900"
            >
              See how it works
            </Link>
          </div>
          <p className="at-fade-in at-delay-3 mt-6 text-[13px] leading-6 text-ink-500">
            First hour free · No credit card · {STARTING_AT_LABEL}
          </p>
        </div>
      </Container>
    </section>
  );
}
