import Image from "next/image";
import Link from "next/link";

import { TrackCta } from "@/components/marketing/track-cta";
import { WeekRhythm } from "@/components/marketing/week-rhythm";
import { Container } from "@/components/ui/container";
import { HERO_HOUSEHOLD_CUE } from "@/lib/household-pricing-copy.mjs";
import { FREE_TRIAL_CTA } from "@/lib/pricing";

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
    <section className="relative min-h-[80svh] overflow-hidden bg-ink-900 text-white lg:min-h-[84svh]">
      <Image
        src="/images/student-tutoring-session.jpg"
        alt="A student at a home desk during focused academic time"
        fill
        priority
        sizes="100vw"
        className="sh-ken object-cover object-[30%_40%]"
      />
      <div
        className="absolute inset-0 bg-gradient-to-r from-ink-900 via-ink-900/80 to-ink-900/30"
        aria-hidden
      />
      <div className="absolute inset-0 bg-gradient-to-t from-ink-900 via-transparent to-ink-900/25" aria-hidden />

      <Container
        size="wide"
        className="relative z-10 flex min-h-[80svh] flex-col justify-between pb-8 pt-16 sm:pb-12 sm:pt-20 lg:min-h-[84svh] lg:pb-14 lg:pt-20"
      >
        <div>
          <h1 className="at-fade-in mkt-display max-w-[14ch] text-[3.05rem] leading-[1.05] text-white sm:text-[4.4rem] lg:text-[5.4rem]">
            Make studying a habit.
          </h1>
          <p className="at-fade-in at-delay-1 mt-6 max-w-[28rem] text-[16px] leading-7 text-white/78 sm:text-[17px] sm:leading-8">
            One dedicated hour. A real human Guide. A consistent academic routine.
          </p>
          <p className="at-fade-in at-delay-1 mt-3 max-w-[30rem] text-[15px] leading-7 text-white/68">
            Your child gets focused academic time. You get the hour back.
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
            First hour free · No credit card
          </p>
        </div>

        <div className="at-fade-in at-delay-3 mt-10 max-w-xl lg:mt-0 lg:max-w-2xl">
          <p className="mb-2 text-[11px] font-semibold tracking-[0.16em] text-white/45 uppercase">
            A week of Study Hall
          </p>
          <WeekRhythm tone="dark" compact />
        </div>
      </Container>
    </section>
  );
}
