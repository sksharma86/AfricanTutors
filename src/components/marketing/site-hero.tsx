import Image from "next/image";
import Link from "next/link";

import { TrackCta } from "@/components/marketing/track-cta";
import { Container } from "@/components/ui/container";
import { FREE_TRIAL_CTA, PLANS_AS_LOW_AS_LABEL } from "@/lib/pricing";

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

      <Container size="wide" className="relative z-10 flex min-h-[92vh] flex-col justify-end pb-14 pt-28 sm:pb-20">
        <p className="at-fade-in text-[13px] font-medium tracking-[0.18em] text-white/55 uppercase">
          Study Hall (at home)
        </p>
        <h1 className="at-fade-in at-delay-1 mkt-display mt-4 max-w-[16ch] text-[3.1rem] text-white sm:text-[4.4rem] lg:text-[5.4rem]">
          Homework gets done.
          <span className="mt-2 block text-white/62">You get your evening back.</span>
        </h1>
        <p className="at-fade-in at-delay-2 mt-6 max-w-[34rem] text-[17px] leading-8 text-white/78">
          Live online homework supervision that keeps your child focused, encouraged, and on task —
          while a Guide stays present on video.
        </p>
        <div className="at-fade-in at-delay-3 mt-9 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
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
        <p className="at-fade-in at-delay-3 mt-5 text-[13px] text-white/50">
          First hour free · No credit card · {PLANS_AS_LOW_AS_LABEL}
        </p>
      </Container>
    </section>
  );
}
