import { ParentPortalPreview } from "@/components/marketing/product-showcase";
import { Reveal } from "@/components/marketing/reveal";
import { TrackCta } from "@/components/marketing/track-cta";
import { Container } from "@/components/ui/container";
import { FREE_TRIAL_CTA, NO_CARD_REQUIRED } from "@/lib/pricing";

export const PHASE1_HEADLINE = "Homework time. Handled.";
export const PHASE1_SUPPORT =
  "Your child meets one on one with a dedicated Study Hall Guide who stays with them while they work through the homework they already have. The Guide keeps the hour focused, organized, and moving.";

export function Phase1Hero({
  primaryHref,
  primaryLabel = FREE_TRIAL_CTA,
}: {
  primaryHref: string;
  primaryLabel?: string;
}) {
  return (
    <section className="phase1-hero" aria-labelledby="phase1-hero-title">
      <Container size="wide" className="phase1-hero__inner">
        <div className="phase1-hero__copy">
          <Reveal>
            <p className="phase1-kicker">
              <span className="font-semibold tracking-[-0.03em] text-ink-900">Study Hall</span>
              <span className="ml-1.5 font-medium text-ink-400">(at home)</span>
            </p>
          </Reveal>

          <Reveal delay={40}>
            <h1 id="phase1-hero-title" className="phase1-display phase1-hero__title">
              <span className="block">Homework time.</span>
              <span className="block">Handled.</span>
            </h1>
          </Reveal>

          <Reveal delay={80}>
            <p className="phase1-lede phase1-hero__lede">{PHASE1_SUPPORT}</p>
          </Reveal>

          <Reveal delay={120}>
            <div className="phase1-hero__cta">
              <TrackCta href={primaryHref} cta={primaryLabel} location="hero" variant="primary" size="lg">
                {primaryLabel}
              </TrackCta>
            </div>
            <p className="phase1-hero__facts">
              60 minutes
              <span className="phase1-dot" aria-hidden>·</span>
              One on one
              <span className="phase1-dot" aria-hidden>·</span>
              {NO_CARD_REQUIRED.replace(/\.$/, "")}
            </p>
          </Reveal>
        </div>

        <Reveal delay={160}>
          <div className="phase1-hero__product" aria-label="Parent Portal preview">
            <p className="sr-only">
              Parent Portal showing Jordan&apos;s next Study Hall at 6:30 PM with Guide James
            </p>
            <ParentPortalPreview />
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
