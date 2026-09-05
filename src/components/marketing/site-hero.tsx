import Image from "next/image";

import { TrackCta } from "@/components/marketing/track-cta";
import { Container } from "@/components/ui/container";
import { START_FREE_CTA } from "@/lib/public-offers";

export function SiteHero({
  primaryHref,
  primaryLabel = START_FREE_CTA,
}: {
  primaryHref: string;
  primaryLabel?: string;
  hourlyLowUsd?: number;
  hourlyHighUsd?: number;
}) {
  return (
    <section className="relative min-h-[64svh] overflow-hidden bg-ink-900 text-white sm:min-h-[70svh] lg:min-h-[78svh]">
      <Image
        src="/images/student-tutoring-session.jpg"
        alt="A student at a home desk during focused academic time"
        fill
        priority
        sizes="100vw"
        className="sh-ken object-cover object-[38%_32%]"
      />
      <div
        className="absolute inset-0 bg-gradient-to-r from-ink-900/58 via-ink-900/28 to-transparent"
        aria-hidden
      />
      <div className="absolute inset-0 bg-gradient-to-t from-ink-900/40 via-transparent to-ink-900/10" aria-hidden />

      <Container
        size="wide"
        className="relative z-10 flex min-h-[64svh] flex-col justify-end pb-12 pt-20 sm:min-h-[70svh] sm:pb-16 lg:min-h-[78svh] lg:pb-20"
      >
        <h1 className="at-fade-in mkt-display max-w-[13ch] text-[3.1rem] leading-[1.02] text-white sm:text-[4.6rem] lg:text-[5.6rem]">
          Make studying a habit.
        </h1>
        <p className="at-fade-in at-delay-1 mt-5 max-w-[28rem] text-[17px] leading-8 text-white/86 sm:text-[18px]">
          A focused hour with a real human Guide to help your child show up, stay on task, and get the work done.
        </p>
        <div className="at-fade-in at-delay-2 mt-8">
          <TrackCta href={primaryHref} cta={primaryLabel} location="hero" variant="secondary" size="lg">
            {primaryLabel}
          </TrackCta>
        </div>
        <p className="at-fade-in at-delay-3 mt-4 text-[13px] tracking-wide text-white/62">
          First Study Hall free. No credit card required.
        </p>
      </Container>
    </section>
  );
}
