import Image from "next/image";

import { ParentPortalPreview } from "@/components/marketing/product-showcase";
import { Reveal } from "@/components/marketing/reveal";
import { TrackCta } from "@/components/marketing/track-cta";
import { Container } from "@/components/ui/container";
import {
  HOW_IT_WORKS_FAQ,
  HOW_IT_WORKS_FAQ_HEADLINE,
  HOW_IT_WORKS_FAQ_KICKER,
  HOW_IT_WORKS_GUIDE_DISTINCTION,
  HOW_IT_WORKS_GUIDE_DOES,
  HOW_IT_WORKS_GUIDE_HEADLINE,
  HOW_IT_WORKS_GUIDE_KICKER,
  HOW_IT_WORKS_GUIDE_LEDE,
  HOW_IT_WORKS_HERO_HEADLINE,
  HOW_IT_WORKS_HERO_MICROCOPY,
  HOW_IT_WORKS_HERO_SUPPORT,
  HOW_IT_WORKS_JOURNEY_HEADLINE,
  HOW_IT_WORKS_JOURNEY_KICKER,
  HOW_IT_WORKS_JOURNEY_LEDE,
  HOW_IT_WORKS_PARENT_GETS,
  HOW_IT_WORKS_PARENT_HEADLINE,
  HOW_IT_WORKS_PARENT_KICKER,
  HOW_IT_WORKS_PARENT_LEDE,
  HOW_IT_WORKS_STEPS,
  HOW_IT_WORKS_TRUST_HEADLINE,
  HOW_IT_WORKS_TRUST_ITEMS,
  HOW_IT_WORKS_TRUST_KICKER,
  HOW_IT_WORKS_WHO_HEADLINE,
  HOW_IT_WORKS_WHO_ITEMS,
  HOW_IT_WORKS_WHO_KICKER,
} from "@/lib/galaxy-1b-copy";

export function HowItWorksHero({
  primaryHref,
  primaryLabel,
}: {
  primaryHref: string;
  primaryLabel: string;
}) {
  return (
    <section className="sh-home-hero sh-galaxy-hero">
      <Image
        src="/images/marketing/studyhall-hero-desk.webp"
        alt="A child at a home desk during a private Study Hall with one live Guide on the laptop"
        fill
        priority
        sizes="100vw"
        className="sh-home-hero__photo sh-galaxy-hero__photo--desk"
      />
      <div className="sh-home-hero__shade" aria-hidden />
      <Container size="wide" className="sh-home-hero__inner">
        <h1 className="sh-home-display sh-home-hero__title sh-galaxy-hero__title">{HOW_IT_WORKS_HERO_HEADLINE}</h1>
        <p className="sh-home-hero__support sh-galaxy-hero__support">{HOW_IT_WORKS_HERO_SUPPORT}</p>
        <div className="sh-home-hero__cta">
          <TrackCta
            href={primaryHref}
            cta={primaryLabel}
            location="how_it_works_hero"
            variant="secondary"
            size="lg"
            className="sh-home-hero__button"
          >
            {primaryLabel}
          </TrackCta>
        </div>
        <p className="sh-home-hero__facts">{HOW_IT_WORKS_HERO_MICROCOPY}</p>
      </Container>
    </section>
  );
}

export function HowItWorksJourney({ household }: { household: string }) {
  return (
    <section className="sh-galaxy-journey">
      <Container size="wide">
        <Reveal>
          <p className="sh-home-kicker">{HOW_IT_WORKS_JOURNEY_KICKER}</p>
          <h2 className="sh-home-display sh-galaxy-section-title">{HOW_IT_WORKS_JOURNEY_HEADLINE}</h2>
          <p className="sh-galaxy-lede">{HOW_IT_WORKS_JOURNEY_LEDE}</p>
        </Reveal>
        <ol className="sh-galaxy-steps">
          {HOW_IT_WORKS_STEPS.map((step) => (
            <li key={step.label} className="sh-galaxy-step">
              <p className="sh-home-kicker">{step.label}</p>
              <p className="sh-galaxy-step__body">{step.body}</p>
            </li>
          ))}
        </ol>
        <p className="sh-galaxy-household">{household}</p>
      </Container>
    </section>
  );
}

export function HowItWorksGuide() {
  return (
    <section className="sh-galaxy-guide">
      <Container size="wide">
        <div className="sh-galaxy-split">
          <Reveal>
            <p className="sh-home-kicker">{HOW_IT_WORKS_GUIDE_KICKER}</p>
            <h2 className="sh-home-display sh-galaxy-section-title">{HOW_IT_WORKS_GUIDE_HEADLINE}</h2>
            <p className="sh-galaxy-lede">{HOW_IT_WORKS_GUIDE_LEDE}</p>
            <ul className="sh-galaxy-list">
              {HOW_IT_WORKS_GUIDE_DOES.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p className="sh-galaxy-distinction">{HOW_IT_WORKS_GUIDE_DISTINCTION}</p>
          </Reveal>
          <Reveal delay={70}>
            <div className="sh-galaxy-visual">
              <Image
                src="/images/marketing/studyhall-focus-close.webp"
                alt="A student writing at home while one live Guide appears on the laptop"
                fill
                sizes="(max-width: 1024px) 100vw, 46vw"
                loading="eager"
                className="object-cover object-[68%_42%]"
              />
            </div>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}

export function HowItWorksParent() {
  return (
    <section className="sh-home-portal sh-galaxy-parent">
      <Container size="wide">
        <div className="sh-home-portal__intro">
          <Reveal>
            <p className="sh-home-kicker">{HOW_IT_WORKS_PARENT_KICKER}</p>
            <h2 className="sh-home-display sh-home-portal__title">{HOW_IT_WORKS_PARENT_HEADLINE}</h2>
            <p className="sh-home-portal__lede">{HOW_IT_WORKS_PARENT_LEDE}</p>
          </Reveal>
        </div>
        <Reveal delay={60}>
          <div className="sh-home-portal__stage sh-galaxy-parent__stage">
            <div className="sh-home-portal__frame" aria-label="Parent Portal">
              <p className="sr-only">
                Real Parent Portal home: next Study Hall, join, reports, recordings, and hours.
              </p>
              <ParentPortalPreview />
            </div>
          </div>
          <p className="sh-galaxy-uses">{HOW_IT_WORKS_PARENT_GETS.join("  ·  ")}</p>
        </Reveal>
      </Container>
    </section>
  );
}

export function HowItWorksTrust() {
  return (
    <section className="sh-galaxy-trust">
      <Container size="wide">
        <Reveal>
          <p className="sh-home-kicker sh-galaxy-trust__kicker">{HOW_IT_WORKS_TRUST_KICKER}</p>
          <h2 className="sh-home-display sh-galaxy-section-title sh-galaxy-trust__title">
            {HOW_IT_WORKS_TRUST_HEADLINE}
          </h2>
          <ul className="sh-galaxy-trust__list">
            {HOW_IT_WORKS_TRUST_ITEMS.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Reveal>
      </Container>
    </section>
  );
}

export function HowItWorksWho() {
  return (
    <section className="sh-galaxy-who">
      <Container size="wide">
        <Reveal>
          <p className="sh-home-kicker">{HOW_IT_WORKS_WHO_KICKER}</p>
          <h2 className="sh-home-display sh-galaxy-who__title">{HOW_IT_WORKS_WHO_HEADLINE}</h2>
          <ul className="sh-galaxy-who__list">
            {HOW_IT_WORKS_WHO_ITEMS.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Reveal>
      </Container>
    </section>
  );
}

export function HowItWorksFaq() {
  return (
    <section className="sh-galaxy-faq">
      <Container size="wide">
        <Reveal>
          <p className="sh-home-kicker">{HOW_IT_WORKS_FAQ_KICKER}</p>
          <h2 className="sh-home-display sh-galaxy-section-title">{HOW_IT_WORKS_FAQ_HEADLINE}</h2>
        </Reveal>
        <dl className="sh-galaxy-faq__list">
          {HOW_IT_WORKS_FAQ.map((item) => (
            <div key={item.q}>
              <details className="sh-galaxy-faq__item">
                <summary>
                  <dt>{item.q}</dt>
                  <span aria-hidden>+</span>
                </summary>
                <dd>{item.a}</dd>
              </details>
            </div>
          ))}
        </dl>
      </Container>
    </section>
  );
}

export function HowItWorksCta({
  primaryHref,
  primaryLabel,
}: {
  primaryHref: string;
  primaryLabel: string;
}) {
  return (
    <section className="sh-galaxy-cta">
      <Container size="wide">
        <Reveal>
          <h2 className="sh-home-display sh-galaxy-cta__title">Try your first Study Hall free</h2>
          <p className="sh-galaxy-cta__support">A personal hour, with a live Guide, right at home.</p>
          <TrackCta
            href={primaryHref}
            cta={primaryLabel}
            location="how_it_works_footer"
            variant="secondary"
            size="lg"
            className="sh-home-hero__button"
          >
            {primaryLabel}
          </TrackCta>
          <p className="sh-galaxy-cta__micro">{HOW_IT_WORKS_HERO_MICROCOPY}</p>
        </Reveal>
      </Container>
    </section>
  );
}
