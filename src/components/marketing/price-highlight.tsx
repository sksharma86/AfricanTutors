import { LinkButton } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { HOURLY_RATE } from "@/lib/constants";

export function PriceHighlight({
  eyebrow = "Simple Pricing",
  title = "One student. One tutor. One hour.",
  ctaHref = "/signup",
  ctaLabel = "Get Started",
}: {
  eyebrow?: string;
  title?: string;
  ctaHref?: string;
  ctaLabel?: string;
}) {
  return (
    <section className="py-20">
      <Container>
        <div className="overflow-hidden rounded-3xl bg-ink-900">
          <div className="flex flex-col items-center gap-8 px-6 py-14 text-center sm:px-14">
            <p className="text-sm font-semibold tracking-wide text-gold-300 uppercase">
              {eyebrow}
            </p>
            <h2 className="max-w-lg font-display text-2xl font-semibold text-white sm:text-3xl">
              {title}
            </h2>
            <div className="flex items-end gap-2">
              <span className="font-display text-6xl font-semibold text-gold-400 sm:text-7xl">
                {HOURLY_RATE}
              </span>
              <span className="pb-2 text-lg font-medium text-ink-200 sm:pb-3">/ hour</span>
            </div>
            <p className="max-w-md text-sm leading-6 text-ink-300">
              Live, one-on-one online tutoring. No packages to buy, no long-term contract
              &mdash; pay for the sessions your student needs.
            </p>
            <LinkButton href={ctaHref} variant="secondary" size="lg">
              {ctaLabel}
            </LinkButton>
          </div>
        </div>
      </Container>
    </section>
  );
}
