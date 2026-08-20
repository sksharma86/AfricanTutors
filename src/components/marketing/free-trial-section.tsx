import { Container } from "@/components/ui/container";
import { TrackCta } from "@/components/marketing/track-cta";

export function FreeTrialSection({
  ctaHref,
  ctaLabel,
}: {
  ctaHref: string;
  ctaLabel: string;
}) {
  return (
    <section className="py-16">
      <Container>
        <div className="overflow-hidden rounded-3xl bg-ink-900 p-8 sm:p-12">
          <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
            <div className="max-w-xl">
              <p className="text-xs font-semibold tracking-wide text-gold-300 uppercase">Free trial</p>
              <h2 className="mt-3 font-display text-3xl font-semibold text-white sm:text-4xl">
                Try African Tutors before you pay a dollar.
              </h2>
              <ul className="mt-5 space-y-2 text-base leading-7 text-ink-200">
                {[
                  "A real 30-minute one-on-one session",
                  "No credit card, no payment information",
                  "One free trial per customer account",
                ].map((line) => (
                  <li key={line} className="flex items-start gap-2.5">
                    <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor" className="mt-1 h-4 w-4 flex-none text-gold-300">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
                    </svg>
                    {line}
                  </li>
                ))}
              </ul>
            </div>
            <div className="shrink-0">
              <TrackCta href={ctaHref} cta={ctaLabel} location="free_trial_section" variant="secondary" size="lg">
                {ctaLabel}
              </TrackCta>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
