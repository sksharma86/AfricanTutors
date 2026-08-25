import { TrackCta } from "@/components/marketing/track-cta";
import { Container } from "@/components/ui/container";
import { AS_LOW_AS_LABEL, FREE_TRIAL_CTA, NO_CARD_REQUIRED } from "@/lib/pricing";

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
    <section className="bg-ink-900 py-20 text-white sm:py-24">
      <Container size="wide">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="mkt-display text-3xl sm:text-4xl">{title}</h2>
          <p className="mx-auto mt-4 max-w-lg text-[17px] leading-7 text-white/65">{description}</p>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <TrackCta
              href={primaryHref}
              cta={primaryLabel}
              location="final_cta"
              variant="secondary"
              size="lg"
            >
              {primaryLabel}
            </TrackCta>
            {secondaryHref && secondaryLabel ? (
              <TrackCta
                href={secondaryHref}
                cta={secondaryLabel}
                location="final_cta_secondary"
                variant="text"
                className="text-white/70 hover:text-white"
              >
                {secondaryLabel}
              </TrackCta>
            ) : null}
          </div>
          <p className="mt-5 text-sm text-white/45">
            {NO_CARD_REQUIRED} {AS_LOW_AS_LABEL}.
          </p>
        </div>
      </Container>
    </section>
  );
}
