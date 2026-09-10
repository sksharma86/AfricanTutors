import Image from "next/image";

import { TrackCta } from "@/components/marketing/track-cta";
import { Container } from "@/components/ui/container";
import { FREE_TRIAL_CTA } from "@/lib/pricing";

export const HOME_HERO_HEADLINE = "Give your child an edge.";
export const HOME_HERO_SUPPORT = "Private, one on one Study Halls. Right at home.";

export function HomeHero({
  primaryHref,
  primaryLabel = FREE_TRIAL_CTA,
}: {
  primaryHref: string;
  primaryLabel?: string;
}) {
  return (
    <section id="home-hero" className="sh-home-hero">
      <Image
        src="/images/marketing/studyhall-focus-close.webp"
        alt="A child at a home desk writing while a live Study Hall Guide appears on the laptop"
        fill
        priority
        sizes="100vw"
        className="sh-home-hero__photo"
      />
      <div className="sh-home-hero__shade" aria-hidden />

      <Container size="wide" className="sh-home-hero__inner">
        <h1 className="sh-home-display sh-home-hero__title">{HOME_HERO_HEADLINE}</h1>
        <p className="sh-home-hero__support">{HOME_HERO_SUPPORT}</p>
        <div className="sh-home-hero__cta">
          <TrackCta
            href={primaryHref}
            cta={primaryLabel}
            location="hero"
            variant="secondary"
            size="lg"
            className="sh-home-hero__button"
          >
            {primaryLabel}
          </TrackCta>
        </div>
        <p className="sh-home-hero__facts">
          60 minutes
          <span aria-hidden>·</span>
          One on one
          <span aria-hidden>·</span>
          No credit card
        </p>
      </Container>
    </section>
  );
}
