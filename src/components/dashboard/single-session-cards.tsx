import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SESSION_OPTIONS, formatUsd } from "@/lib/pricing";

/**
 * "Book a single session" — the pay-per-session option shown ABOVE prepaid
 * packages so customers don't think a prepaid routine is the minimum commitment.
 *
 * Prices come from the authoritative SESSION_OPTIONS constant (never a hardcoded
 * literal here). CTAs enter the existing booking wizard with the duration
 * preselected via a safe query param; all booking/pricing/free-trial logic stays
 * server-authoritative and unchanged.
 */
const COPY: Record<number, string> = {
  60: "Pay as you go — a full hour of supervised Study Hall for nightly homework.",
  120: "A heavier homework night — two continuous hours with one Guide.",
  180: "Exam prep, catch-up, or projects — three continuous hours of focus.",
};

export function SingleSessionCards() {
  return (
    <section>
      <h2 className="text-sm font-semibold tracking-wide text-ink-500 uppercase">Book a single session</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
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
                Book {option.label}
              </LinkButton>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}
