import { Reveal } from "@/components/marketing/reveal";
import { TrackCta } from "@/components/marketing/track-cta";
import { Container } from "@/components/ui/container";
import { FAQ_ITEMS, type FaqItem } from "@/lib/faq";

export const FAQ_PAGE_KICKER = "FAQ";
export const FAQ_PAGE_HEADLINE = "Questions, answered.";
export const FAQ_PAGE_LEDE =
  "Short answers about what Study Hall is, what the Guide does, recordings, siblings, pricing, and the first free hour.";
export const FAQ_PAGE_CTA_HEADLINE = "Try your first Study Hall free";
export const FAQ_PAGE_CTA_SUPPORT = "A personal hour, with a live Guide, right at home.";
export const FAQ_PAGE_CTA_MICRO = "No credit card required";

/**
 * /faq — an information page in the Galaxy 2 system. Restrained charcoal
 * masthead (no photography), then a paper reading surface with one highly
 * readable accordion. Content is the canonical FAQ_ITEMS, unchanged.
 */
export function FaqHero() {
  return (
    <section className="sh-faq-hero">
      <Container size="wide">
        <p className="sh-home-kicker sh-home-kicker--light">{FAQ_PAGE_KICKER}</p>
        <h1 className="sh-home-display sh-faq-hero__title">{FAQ_PAGE_HEADLINE}</h1>
        <p className="sh-faq-hero__lede">{FAQ_PAGE_LEDE}</p>
      </Container>
    </section>
  );
}

export function FaqList({ items = FAQ_ITEMS }: { items?: FaqItem[] }) {
  return (
    <section className="sh-faq-body" aria-label="Frequently asked questions">
      <Container size="wide">
        <dl className="sh-faq-list">
          {items.map((item) => (
            <div key={item.q}>
              <details className="sh-faq-item">
                <summary>
                  <dt>{item.q}</dt>
                  <span className="sh-faq-item__mark" aria-hidden>
                    <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.75} stroke="currentColor">
                      <path strokeLinecap="round" d="M12 5v14M5 12h14" />
                    </svg>
                  </span>
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

export function FaqCta({ primaryHref, primaryLabel }: { primaryHref: string; primaryLabel: string }) {
  return (
    <section className="sh-galaxy-cta">
      <Container size="wide">
        <Reveal>
          <h2 className="sh-home-display sh-galaxy-cta__title">{FAQ_PAGE_CTA_HEADLINE}</h2>
          <p className="sh-galaxy-cta__support">{FAQ_PAGE_CTA_SUPPORT}</p>
          <TrackCta
            href={primaryHref}
            cta={primaryLabel}
            location="faq_footer"
            variant="secondary"
            size="lg"
            className="sh-home-hero__button"
          >
            {primaryLabel}
          </TrackCta>
          <p className="sh-galaxy-cta__micro">{FAQ_PAGE_CTA_MICRO}</p>
        </Reveal>
      </Container>
    </section>
  );
}
