import { TrackCta } from "@/components/marketing/track-cta";
import { Container } from "@/components/ui/container";
import { NO_CARD_REQUIRED } from "@/lib/pricing";
import { START_FREE_CTA } from "@/lib/public-offers";

export function FreeTrialSection({
  ctaHref = "/signup",
  ctaLabel = START_FREE_CTA,
}: {
  ctaHref?: string;
  ctaLabel?: string;
}) {
  return (
    <section className="py-20 sm:py-24">
      <Container size="wide">
        <div className="mx-auto max-w-xl text-center">
          <p className="mkt-eyebrow">First session free</p>
          <h2 className="mkt-display mt-3 text-3xl text-ink-900 sm:text-4xl">
            One full hour — on us.
          </h2>
          <p className="mx-auto mt-4 text-[17px] leading-7 text-ink-500">
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
