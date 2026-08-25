import { TrackCta } from "@/components/marketing/track-cta";
import { Container } from "@/components/ui/container";
import { FREE_TRIAL_CTA, NO_CARD_REQUIRED } from "@/lib/pricing";

/**
 * Compact free-session emphasis used on interior marketing pages.
 * Homepage places free-session messaging in hero + final CTA instead.
 */
export function FreeTrialSection({
  ctaHref = "/signup",
  ctaLabel = FREE_TRIAL_CTA,
}: {
  ctaHref?: string;
  ctaLabel?: string;
}) {
  return (
    <section className="py-20 sm:py-24">
      <Container size="wide">
        <div className="mx-auto max-w-2xl text-center">
          <p className="mkt-eyebrow">First session free</p>
          <h2 className="mkt-display mt-4 text-4xl text-ink-900 sm:text-5xl">
            One full hour of Study Hall — on us.
          </h2>
          <p className="mx-auto mt-5 max-w-lg text-base leading-7 text-ink-500">
            Eligible new families get a real 60-minute Study Hall with a highly vetted Guide.{" "}
            {NO_CARD_REQUIRED}
          </p>
          <div className="mt-8">
            <TrackCta href={ctaHref} cta={ctaLabel} location="free_trial" variant="primary" size="lg">
              {ctaLabel}
            </TrackCta>
          </div>
        </div>
      </Container>
    </section>
  );
}
