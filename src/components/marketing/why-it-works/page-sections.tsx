import Image from "next/image";

import { Reveal } from "@/components/marketing/reveal";
import { TrackCta } from "@/components/marketing/track-cta";
import { Container } from "@/components/ui/container";
import {
  WHY_IT_WORKS_ACCOUNTABILITY_BODY,
  WHY_IT_WORKS_ACCOUNTABILITY_HEADLINE,
  WHY_IT_WORKS_AFTER,
  WHY_IT_WORKS_AFTER_LABEL,
  WHY_IT_WORKS_BEFORE,
  WHY_IT_WORKS_BEFORE_LABEL,
  WHY_IT_WORKS_CONSISTENCY_BODY,
  WHY_IT_WORKS_CONSISTENCY_HEADLINE,
  WHY_IT_WORKS_CORE_BODY,
  WHY_IT_WORKS_CORE_HEADLINE,
  WHY_IT_WORKS_CORE_KICKER,
  WHY_IT_WORKS_FOCUS_BODY,
  WHY_IT_WORKS_FOCUS_HEADLINE,
  WHY_IT_WORKS_FOLLOW_BODY,
  WHY_IT_WORKS_FOLLOW_HEADLINE,
  WHY_IT_WORKS_FRICTION,
  WHY_IT_WORKS_FRICTION_HEADLINE,
  WHY_IT_WORKS_HERO_HEADLINE,
  WHY_IT_WORKS_HERO_MICROCOPY,
  WHY_IT_WORKS_HERO_SUPPORT,
  WHY_IT_WORKS_ORGANIZE_BODY,
  WHY_IT_WORKS_ORGANIZE_HEADLINE,
  WHY_IT_WORKS_PRICING_LABEL,
  WHY_IT_WORKS_RHYTHM_BODY,
  WHY_IT_WORKS_RHYTHM_HEADLINE,
  WHY_IT_WORKS_UNLIMITED_BODY,
  WHY_IT_WORKS_UNLIMITED_HEADLINE,
  WHY_IT_WORKS_UNLIMITED_KICKER,
  WHY_IT_WORKS_WEEK_HEADLINE,
  WHY_IT_WORKS_WEEK_KICKER,
  WHY_IT_WORKS_WEEK_LEDE,
  WHY_IT_WORKS_WEEK_MARKS,
  WHY_IT_WORKS_WEEKDAYS,
} from "@/lib/galaxy-1b-copy";

export function WhyItWorksHero({
  primaryHref,
  primaryLabel,
}: {
  primaryHref: string;
  primaryLabel: string;
}) {
  return (
    <section className="sh-home-hero sh-galaxy-hero">
      <Image
        src="/images/marketing/studyhall-routine-evening.webp"
        alt="A quieter evening at home while a child works with one live Study Hall Guide"
        fill
        priority
        sizes="100vw"
        className="sh-home-hero__photo sh-galaxy-hero__photo--evening"
      />
      <div className="sh-home-hero__shade" aria-hidden />
      <Container size="wide" className="sh-home-hero__inner">
        <h1 className="sh-home-display sh-home-hero__title sh-galaxy-hero__title">{WHY_IT_WORKS_HERO_HEADLINE}</h1>
        <p className="sh-home-hero__support sh-galaxy-hero__support">{WHY_IT_WORKS_HERO_SUPPORT}</p>
        <div className="sh-home-hero__cta">
          <TrackCta
            href={primaryHref}
            cta={primaryLabel}
            location="why_it_works_hero"
            variant="secondary"
            size="lg"
            className="sh-home-hero__button"
          >
            {primaryLabel}
          </TrackCta>
        </div>
        <p className="sh-home-hero__facts">{WHY_IT_WORKS_HERO_MICROCOPY}</p>
      </Container>
    </section>
  );
}

export function WhyItWorksCore() {
  return (
    <section className="sh-galaxy-core">
      <Container size="wide">
        <Reveal>
          <p className="sh-home-kicker">{WHY_IT_WORKS_CORE_KICKER}</p>
          <h2 className="sh-home-display sh-galaxy-section-title sh-galaxy-core__title">
            {WHY_IT_WORKS_CORE_HEADLINE}
          </h2>
          <p className="sh-galaxy-lede sh-galaxy-core__body">{WHY_IT_WORKS_CORE_BODY}</p>
        </Reveal>
        <Reveal delay={40}>
          <div className="sh-galaxy-nights" role="group" aria-label="Most weeknights compared with a standing Study Hall">
            <div className="sh-galaxy-night sh-galaxy-night--before">
              <p className="sh-home-evening__label">{WHY_IT_WORKS_BEFORE_LABEL}</p>
              <ul className="sh-galaxy-night__list">
                {WHY_IT_WORKS_BEFORE.map((line) => (
                  <li key={line}>
                    <span className="sh-home-evening__mark sh-home-evening__mark--no" aria-hidden>
                      ×
                    </span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="sh-galaxy-night sh-galaxy-night--after">
              <p className="sh-home-evening__label">{WHY_IT_WORKS_AFTER_LABEL}</p>
              <ul className="sh-galaxy-night__list">
                {WHY_IT_WORKS_AFTER.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}

export function WhyItWorksWeek() {
  return (
    <section className="sh-galaxy-week">
      <Container size="wide">
        <Reveal>
          <p className="sh-home-kicker">{WHY_IT_WORKS_WEEK_KICKER}</p>
          <h2 className="sh-home-display sh-galaxy-section-title">{WHY_IT_WORKS_WEEK_HEADLINE}</h2>
          <p className="sh-galaxy-lede">{WHY_IT_WORKS_WEEK_LEDE}</p>
        </Reveal>
        <ol className="sh-galaxy-week__strip">
          {WHY_IT_WORKS_WEEKDAYS.map((day, index) => (
            <li
              key={day}
              className={WHY_IT_WORKS_WEEK_MARKS[index] ? "sh-galaxy-week__day is-on" : "sh-galaxy-week__day"}
            >
              <span>{day}</span>
              <strong>{WHY_IT_WORKS_WEEK_MARKS[index] ? "Study Hall" : "Open evening"}</strong>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}

export function WhyItWorksBenefits() {
  return (
    <section className="sh-galaxy-benefits">
      <Container size="wide">
        <Reveal>
          <div className="sh-galaxy-benefit-pair">
            <div>
              <p className="sh-home-kicker">{WHY_IT_WORKS_CONSISTENCY_HEADLINE}</p>
              <p className="sh-galaxy-benefit-copy">{WHY_IT_WORKS_CONSISTENCY_BODY}</p>
            </div>
            <div>
              <p className="sh-home-kicker">{WHY_IT_WORKS_ACCOUNTABILITY_HEADLINE}</p>
              <p className="sh-galaxy-benefit-copy">{WHY_IT_WORKS_ACCOUNTABILITY_BODY}</p>
            </div>
          </div>
        </Reveal>
      </Container>

      <div className="sh-galaxy-focus">
        <Container size="wide">
          <Reveal>
            <p className="sh-home-kicker">{WHY_IT_WORKS_FOCUS_HEADLINE}</p>
            <h2 className="sh-home-display sh-galaxy-focus__title">{WHY_IT_WORKS_FOCUS_BODY}</h2>
          </Reveal>
        </Container>
      </div>

      <Container size="wide">
        <Reveal>
          <div className="sh-galaxy-friction">
            <p className="sh-home-kicker sh-galaxy-friction__kicker">{WHY_IT_WORKS_FRICTION_HEADLINE}</p>
            <ul className="sh-galaxy-friction__list">
              {WHY_IT_WORKS_FRICTION.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        </Reveal>

        <Reveal delay={40}>
          <div className="sh-galaxy-split sh-galaxy-follow">
            <div>
              <p className="sh-home-kicker">{WHY_IT_WORKS_ORGANIZE_HEADLINE}</p>
              <p className="sh-galaxy-benefit-copy">{WHY_IT_WORKS_ORGANIZE_BODY}</p>
              <p className="sh-home-kicker sh-galaxy-follow__kicker">{WHY_IT_WORKS_FOLLOW_HEADLINE}</p>
              <p className="sh-galaxy-benefit-copy">{WHY_IT_WORKS_FOLLOW_BODY}</p>
            </div>
            <div className="sh-galaxy-visual">
              <Image
                src="/images/marketing/studyhall-focus-close.webp"
                alt="One child at a home desk with one live Guide present on the laptop"
                fill
                sizes="(max-width: 1024px) 100vw, 46vw"
                loading="eager"
                className="object-cover object-[68%_42%]"
              />
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}

export function WhyItWorksRhythm() {
  return (
    <section className="sh-galaxy-rhythm">
      <div className="sh-galaxy-rhythm__photo">
        <Image
          src="/images/marketing/studyhall-hero-desk.webp"
          alt="A focused child at a home desk during a personal Study Hall"
          fill
          sizes="100vw"
          loading="eager"
          className="object-cover object-[60%_22%]"
        />
      </div>
      <Container size="wide" className="sh-galaxy-rhythm__copy">
        <Reveal>
          <h2 className="sh-home-display sh-galaxy-section-title">{WHY_IT_WORKS_RHYTHM_HEADLINE}</h2>
          <p className="sh-galaxy-lede">{WHY_IT_WORKS_RHYTHM_BODY}</p>
        </Reveal>
      </Container>
    </section>
  );
}

export function WhyItWorksUnlimited({
  primaryHref,
  primaryLabel,
}: {
  primaryHref: string;
  primaryLabel: string;
}) {
  return (
    <section className="sh-galaxy-cta sh-galaxy-unlimited">
      <Container size="wide">
        <Reveal>
          <p className="sh-home-kicker sh-galaxy-trust__kicker">{WHY_IT_WORKS_UNLIMITED_KICKER}</p>
          <h2 className="sh-home-display sh-galaxy-cta__title">{WHY_IT_WORKS_UNLIMITED_HEADLINE}</h2>
          <p className="sh-galaxy-cta__support">{WHY_IT_WORKS_UNLIMITED_BODY}</p>
          <div className="sh-galaxy-unlimited__actions">
            <TrackCta
              href={primaryHref}
              cta={primaryLabel}
              location="why_it_works_unlimited"
              variant="secondary"
              size="lg"
              className="sh-home-hero__button"
            >
              {primaryLabel}
            </TrackCta>
            <TrackCta
              href="/pricing"
              cta={WHY_IT_WORKS_PRICING_LABEL}
              location="why_it_works_pricing"
              variant="outline"
              size="lg"
              className="sh-galaxy-unlimited__pricing"
            >
              {WHY_IT_WORKS_PRICING_LABEL}
            </TrackCta>
          </div>
          <p className="sh-galaxy-cta__micro">{WHY_IT_WORKS_HERO_MICROCOPY}</p>
        </Reveal>
      </Container>
    </section>
  );
}
