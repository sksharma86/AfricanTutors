import Image from "next/image";
import Link from "next/link";

import { TrackCta } from "@/components/marketing/track-cta";
import { Container } from "@/components/ui/container";
import { HERO_HOUSEHOLD_CUE } from "@/lib/household-pricing-copy.mjs";
import { FREE_TRIAL_CTA, PREPAID_FROM_HOURLY_USD } from "@/lib/pricing";

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
    <section className="relative min-h-[92vh] overflow-hidden bg-ink-900 text-white">
      <Image
        src="/images/student-tutoring-session.jpg"
        alt="A student at home working through homework on a laptop"
        fill
        priority
        sizes="100vw"
        className="sh-ken object-cover object-[30%_40%]"
      />
      <div
        className="absolute inset-0 bg-gradient-to-r from-ink-900 via-ink-900/78 to-ink-900/25"
        aria-hidden
      />
      <div className="absolute inset-0 bg-gradient-to-t from-ink-900 via-transparent to-ink-900/20" aria-hidden />

      <Container size="wide" className="relative z-10 flex min-h-[92vh] flex-col justify-end pb-12 pt-28 sm:pb-20">
        <h1 className="at-fade-in mkt-display max-w-[16ch] text-[3.05rem] leading-[1.05] text-white sm:text-[4.4rem] lg:text-[5.4rem]">
          Homework gets done.
          <span className="mt-2 block text-white/62">You get your evening back.</span>
        </h1>
        <p className="at-fade-in at-delay-1 mt-6 max-w-[30rem] text-[16px] leading-7 text-white/74 sm:text-[17px] sm:leading-8">
          Live homework supervision that keeps your child focused, encouraged, and on task.
        </p>
        <p className="at-fade-in at-delay-1 mt-3 text-[15px] font-medium text-white/68 sm:text-[16px]">
          {HERO_HOUSEHOLD_CUE}
        </p>
        <div className="at-fade-in at-delay-2 mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <TrackCta href={primaryHref} cta={primaryLabel} location="hero" variant="secondary" size="lg">
            {primaryLabel}
          </TrackCta>
          <Link
            href="/how-it-works"
            className="inline-flex min-h-12 items-center text-[15px] font-semibold text-white/80 underline-offset-4 hover:text-white hover:underline"
          >
            See how it works
          </Link>
        </div>
        <p className="at-fade-in at-delay-3 mt-5 text-[13px] tracking-wide text-white/50">
          First hour free · No credit card · From ${PREPAID_FROM_HOURLY_USD}/hour
        </p>
      </Container>
    </section>
  );
}
