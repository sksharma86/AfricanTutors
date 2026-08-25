import { TrackCta } from "@/components/marketing/track-cta";
import { Container } from "@/components/ui/container";
import { FREE_TRIAL_CTA, NO_CARD_REQUIRED } from "@/lib/pricing";

export function CtaSection({
  title,
  description,
  primaryHref = "/signup",
  primaryLabel = FREE_TRIAL_CTA,
  secondaryHref,
  secondaryLabel,
}: {
  title: string;
  description: string;
  primaryHref?: string;
  primaryLabel?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
}) {
  return (
    <section className="py-24 sm:py-28">
      <Container size="wide">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="mkt-display text-4xl text-ink-900 sm:text-5xl">{title}</h2>
          <p className="mx-auto mt-5 max-w-lg text-base leading-7 text-ink-500">{description}</p>
          <div className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <TrackCta href={primaryHref} cta={primaryLabel} location="final_cta" variant="primary" size="lg">
              {primaryLabel}
            </TrackCta>
            {secondaryHref && secondaryLabel ? (
              <TrackCta
                href={secondaryHref}
                cta={secondaryLabel}
                location="final_cta_secondary"
                variant="text"
              >
                {secondaryLabel}
              </TrackCta>
            ) : null}
          </div>
          <p className="mt-5 text-sm text-ink-400">{NO_CARD_REQUIRED}</p>
        </div>
      </Container>
    </section>
  );
}
