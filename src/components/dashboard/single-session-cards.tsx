import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PAYG_PRICE_USD, formatUsd } from "@/lib/pricing";

/**
 * Pay-as-you-go entry on Hours. One Study Hall is always 60 minutes / $12.
 */
export function SingleSessionCards() {
  return (
    <section>
      <h2 className="text-sm font-semibold tracking-wide text-ink-500 uppercase">Book a single session</h2>
      <div className="mt-4 grid gap-4 sm:max-w-md">
        <Card className="flex flex-col p-6">
          <div className="flex items-start justify-between gap-3">
            <p className="text-xs font-semibold tracking-wide text-gold-700 uppercase">60 minutes</p>
            <p className="font-display text-3xl font-semibold text-ink-900">{formatUsd(PAYG_PRICE_USD)}</p>
          </div>
          <p className="mt-2 text-sm leading-6 text-ink-500">
            Pay as you go — one supervised Study Hall. Duration is always 60 minutes.
          </p>
          <div className="mt-auto pt-5">
            <LinkButton href="/dashboard/student/book" variant="outline" className="w-full">
              Book a Study Hall
            </LinkButton>
          </div>
        </Card>
      </div>
    </section>
  );
}
