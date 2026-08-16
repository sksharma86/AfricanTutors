import { LinkButton } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { FREE_TRIAL_CTA, NO_CARD_REQUIRED, SESSION_OPTIONS, formatUsd } from "@/lib/pricing";

export function PricingTiers() {
  return (
    <Container className="py-16">
      {/* Free trial — the strongest acquisition message. */}
      <div className="overflow-hidden rounded-3xl border border-brand-200 bg-ink-900 p-8 sm:p-10">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="max-w-xl">
            <p className="text-xs font-semibold tracking-wide text-brand-300 uppercase">
              New students
            </p>
            <h2 className="mt-3 font-display text-3xl font-semibold text-white sm:text-4xl">
              Your first 30 minutes are free.
            </h2>
            <p className="mt-3 text-base leading-7 text-ink-200">
              A real one-on-one tutoring session with a qualified tutor &mdash; not a consultation
              or a sales call. {NO_CARD_REQUIRED}
            </p>
          </div>
          <div className="shrink-0">
            <LinkButton href="/signup" variant="secondary" size="lg">
              {FREE_TRIAL_CTA}
            </LinkButton>
          </div>
        </div>
      </div>

      {/* Paid session pricing. */}
      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        {SESSION_OPTIONS.map((option) => (
          <div
            key={option.minutes}
            className="flex items-center justify-between rounded-2xl border border-ink-100 bg-white p-8"
          >
            <div>
              <p className="text-sm font-medium text-ink-500">{option.label}</p>
              <p className="mt-1 text-sm text-ink-400">One-on-one tutoring session</p>
            </div>
            <p className="font-display text-4xl font-semibold text-ink-900">
              {formatUsd(option.priceUsd)}
            </p>
          </div>
        ))}
      </div>
    </Container>
  );
}
