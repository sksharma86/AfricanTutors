import { TrackCta } from "@/components/marketing/track-cta";
import { Container } from "@/components/ui/container";
import { FREE_TRIAL_CTA } from "@/lib/pricing";

export function HomeClose({
  primaryHref,
  primaryLabel = FREE_TRIAL_CTA,
}: {
  primaryHref: string;
  primaryLabel?: string;
}) {
  return (
    <section id="close" className="py-28 sm:py-40">
      <Container size="wide">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="g1-display text-[2.8rem] text-[var(--g1-ink)] sm:text-[4.4rem] lg:text-[5rem]">
            Tonight could be easier.
          </h2>
          <div className="mt-10">
            <TrackCta href={primaryHref} cta={primaryLabel} location="final_cta" variant="primary" size="lg">
              {primaryLabel === FREE_TRIAL_CTA ? "Try your first 60-minute Study Hall free" : primaryLabel}
            </TrackCta>
          </div>
          <p className="mt-5 text-[15px] tracking-wide text-[var(--g1-muted)]">
            One on one.
            <span className="mx-2" aria-hidden>
              ·
            </span>
            No credit card required.
          </p>
        </div>
      </Container>
    </section>
  );
}
