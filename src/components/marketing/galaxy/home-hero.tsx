import { ParentPortalPreview } from "@/components/marketing/product-showcase";
import { TrackCta } from "@/components/marketing/track-cta";
import { Container } from "@/components/ui/container";
import { FREE_TRIAL_CTA, NO_CARD_REQUIRED } from "@/lib/pricing";

export const HERO_HEADLINE = "Homework time. Handled.";
export const HERO_SUPPORT =
  "Your child meets one on one with a dedicated Study Hall Guide who stays with them through the session, helping them stay focused, organized, and moving through the homework they already have.";

export function HomeHero({
  primaryHref,
  primaryLabel = FREE_TRIAL_CTA,
}: {
  primaryHref: string;
  primaryLabel?: string;
}) {
  return (
    <section id="hero" className="relative overflow-hidden pb-10 pt-10 sm:pb-16 sm:pt-16 lg:pb-24 lg:pt-20">
      <Container size="wide">
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1.15fr)] lg:gap-16 xl:gap-20">
          <div>
            <p className="g1-kicker">
              <span className="font-semibold tracking-[-0.03em] text-[var(--g1-ink)]">Study Hall</span>
              <span className="ml-1.5 font-medium text-[var(--g1-subtle)]">(at home)</span>
            </p>
            <h1 className="g1-display mt-5 max-w-[10ch] text-[3.15rem] text-[var(--g1-ink)] sm:text-[4.6rem] lg:text-[5.75rem]">
              {HERO_HEADLINE}
            </h1>
            <p className="g1-lede mt-6 text-[17px] leading-8 sm:text-[18px]">{HERO_SUPPORT}</p>
            <div className="mt-8">
              <TrackCta href={primaryHref} cta={primaryLabel} location="hero" variant="primary" size="lg">
                {primaryLabel}
              </TrackCta>
            </div>
            <p className="mt-4 text-[13px] tracking-wide text-[var(--g1-muted)]">
              60 minutes
              <span className="mx-2 text-[var(--g1-line)]" aria-hidden>
                ·
              </span>
              One on one
              <span className="mx-2 text-[var(--g1-line)]" aria-hidden>
                ·
              </span>
              {NO_CARD_REQUIRED.replace(/\.$/, "")}
            </p>
            <span className="sr-only">Study Hall (at home)</span>
          </div>

          <div className="g1-product mx-auto w-full max-w-[38rem] lg:max-w-none">
            <p className="sr-only">Parent Portal, as it appears for families</p>
            <ParentPortalPreview />
          </div>
        </div>
      </Container>
    </section>
  );
}
