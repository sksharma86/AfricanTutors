import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SESSION_OPTIONS, formatUsd } from "@/lib/pricing";

/**
 * "Book a single session" — the pay-per-session option shown ABOVE prepaid
 * packages so customers don't think a $190 package is the minimum commitment.
 *
 * Prices come from the authoritative SESSION_OPTIONS constant (never a hardcoded
 * literal here). CTAs enter the existing booking wizard with the duration
 * preselected via a safe query param; all booking/pricing/free-trial logic stays
 * server-authoritative and unchanged.
 */
const COPY: Record<number, string> = {
  30: "Quick, focused one-on-one help when you need it.",
  60: "A full one-on-one session for deeper learning and ongoing support.",
};

export function SingleSessionCards() {
  return (
    <section>
      <h2 className="text-sm font-semibold tracking-wide text-ink-500 uppercase">Book a single session</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {SESSION_OPTIONS.map((option) => (
          <Card key={option.minutes} className="flex flex-col p-6">
            <div className="flex items-start justify-between gap-3">
              <p className="text-xs font-semibold tracking-wide text-gold-700 uppercase">{option.label}</p>
              <p className="font-display text-3xl font-semibold text-ink-900">{formatUsd(option.priceUsd)}</p>
            </div>
            <p className="mt-2 text-sm leading-6 text-ink-500">{COPY[option.minutes]}</p>
            <div className="mt-auto pt-5">
              <LinkButton
                href={`/dashboard/student/book?duration=${option.minutes}`}
                variant="outline"
                className="w-full"
              >
                Book {option.minutes} minutes
              </LinkButton>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}
