import Image from "next/image";

import { EditorialLine } from "@/components/marketing/home/editorial";
import { TrackCta } from "@/components/marketing/track-cta";
import { Container } from "@/components/ui/container";
import { FREE_TRIAL_CTA } from "@/lib/pricing";

export const HOME_HERO_HEADLINE = "Give your child an edge.";
export const HOME_HERO_SUPPORT = "Private, one on one Study Halls. Right at home.";
export const HOME_HERO_MICROCOPY = "No credit card required";

/**
 * Moment 1 — cinematic hero. Nearly full-viewport evening photography,
 * one statement, one action. The service is not explained here on purpose.
 */
export function HomeHero({
  primaryHref,
  primaryLabel = FREE_TRIAL_CTA,
}: {
  primaryHref: string;
  primaryLabel?: string;
}) {
  return (
    <section id="home-hero" className="sh-home-hero" aria-labelledby="home-hero-title">
      <div className="sh-home-hero__media" aria-hidden>
        <Image
          src="/images/marketing/galaxy-hero-evening.webp"
          alt=""
          fill
          priority
          sizes="100vw"
          className="sh-home-hero__photo"
        />
      </div>
      <div className="sh-home-hero__shade" aria-hidden />

      <Container size="wide" className="sh-home-hero__inner">
        <div className="sh-home-hero__copy">
          <h1 id="home-hero-title" className="sh-home-display sh-home-hero__title">
            <EditorialLine text={HOME_HERO_HEADLINE} accent="edge." />
          </h1>
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
            <p className="sh-home-hero__facts">{HOME_HERO_MICROCOPY}</p>
          </div>
        </div>
      </Container>
    </section>
  );
}
