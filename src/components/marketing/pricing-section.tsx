import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { cn } from "@/lib/utils";
import type { PublicPackage } from "@/lib/marketing";
import { SESSION_OPTIONS, formatCents, formatUsd } from "@/lib/pricing";

export function PricingSection({
  packages,
  withHeader = true,
}: {
  packages: PublicPackage[];
  withHeader?: boolean;
}) {
  return (
    <section id="pricing" className="scroll-mt-20 py-20">
      <Container>
        {withHeader ? (
          <div className="max-w-2xl">
            <p className="text-sm font-semibold tracking-wide text-gold-700 uppercase">Pricing</p>
            <h2 className="mt-3 font-display text-3xl font-semibold text-ink-900 sm:text-4xl">
              Simple pricing. No surprises.
            </h2>
            <p className="mt-4 text-base leading-7 text-ink-500">
              Pay per session, or save with prepaid tutoring hours. No subscriptions, no recurring
              billing — and prepaid hours never expire.
            </p>
          </div>
        ) : null}

        {/* Standard session pricing */}
        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          {SESSION_OPTIONS.map((option) => (
            <Card key={option.minutes} className="flex items-center justify-between p-7">
              <div>
                <p className="text-sm font-medium text-ink-500">{option.label} session</p>
                <p className="mt-1 text-sm text-ink-400">One-on-one, live with your tutor</p>
              </div>
              <p className="font-display text-4xl font-semibold text-ink-900">{formatUsd(option.priceUsd)}</p>
            </Card>
          ))}
        </div>

        {/* Prepaid packages */}
        <div className="mt-12">
          <h3 className="font-display text-xl font-semibold text-ink-900">Save with prepaid hours</h3>
          <p className="mt-1 text-sm text-ink-500">Prepaid tutoring hours — not a subscription. Hours never expire.</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {packages.map((pkg, i) => {
              const featured = i === 1;
              return (
                <Card key={pkg.id} className={cn("flex flex-col p-6", featured && "border-forest-300 ring-1 ring-forest-200")}>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold tracking-wide text-gold-700 uppercase">
                      {Number.isInteger(pkg.hours) ? `${pkg.hours} hours` : `${pkg.hours.toFixed(1)} hours`}
                    </p>
                    {featured ? (
                      <span className="rounded-full bg-forest-50 px-2 py-0.5 text-[10px] font-bold tracking-wide text-forest-700 uppercase">
                        Balanced choice
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 font-display text-3xl font-semibold text-ink-900">{formatCents(pkg.priceCents)}</p>
                  <p className="mt-1 text-sm text-ink-500">{formatCents(pkg.effectiveHourlyCents)}/hour</p>
                  {pkg.savingsCents > 0 ? (
                    <p className="mt-3 inline-flex w-fit items-center rounded-full bg-forest-50 px-2.5 py-0.5 text-xs font-semibold text-forest-700">
                      Save {formatCents(pkg.savingsCents)} vs. $20/hour
                    </p>
                  ) : null}
                  <p className="mt-3 text-xs text-ink-400">Hours never expire</p>
                </Card>
              );
            })}
          </div>
        </div>
      </Container>
    </section>
  );
}
