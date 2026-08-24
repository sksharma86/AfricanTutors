import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { cn } from "@/lib/utils";
import type { PublicPackage } from "@/lib/marketing";
import { packageBadge } from "@/lib/packages.mjs";
import { PAYG_PRICE_USD, formatCents, formatUsd } from "@/lib/pricing";

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
              Simple pricing built for routine.
            </h2>
            <p className="mt-4 text-base leading-7 text-ink-500">
              Pay as you go, or save with prepaid Study Hall hours that never expire.
            </p>
          </div>
        ) : null}

        {/* Pay as you go */}
        <div className="mt-10">
          <Card className="flex flex-col gap-2 p-7 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold tracking-wide text-gold-700 uppercase">Pay as you go</p>
              <p className="mt-1 font-display text-2xl font-semibold text-ink-900">
                {formatUsd(PAYG_PRICE_USD)}/hour
              </p>
              <p className="mt-1 text-sm text-ink-500">60-minute Study Hall · for flexible use</p>
            </div>
            <p className="font-display text-4xl font-semibold text-ink-900">{formatUsd(PAYG_PRICE_USD)}</p>
          </Card>
        </div>

        {/* Prepaid packages — 14h is the primary (MOST POPULAR) choice */}
        <div className="mt-12">
          <h3 className="font-display text-xl font-semibold text-ink-900">Save with prepaid hours</h3>
          <p className="mt-1 text-sm text-ink-500">
            Built for a consistent Study Hall routine. Hours never expire.
          </p>
          <div className={cn("mt-6 grid gap-4", packages.length <= 2 ? "sm:grid-cols-2" : "sm:grid-cols-3")}>
            {packages.map((pkg) => {
              const badge = packageBadge(pkg.minutes);
              const featured = badge === "MOST POPULAR";
              return (
                <Card
                  key={pkg.id}
                  className={cn(
                    "flex flex-col p-6",
                    featured && "border-forest-400 ring-2 ring-forest-200",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold tracking-wide text-gold-700 uppercase">
                      {pkg.name}
                    </p>
                    {badge ? (
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase",
                          featured
                            ? "bg-forest-600 text-white"
                            : "bg-forest-50 text-forest-700",
                        )}
                      >
                        {badge}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 font-display text-3xl font-semibold text-ink-900">
                    {formatCents(pkg.priceCents)}
                  </p>
                  <p className="mt-1 text-sm text-ink-500">
                    {formatCents(pkg.effectiveHourlyCents)}/hour
                    {Number.isInteger(pkg.hours) ? ` · ${pkg.hours} hours` : ` · ${pkg.hours.toFixed(1)} hours`}
                  </p>
                  <p className="mt-3 text-sm text-ink-500">
                    {featured
                      ? "Built for a consistent routine — roughly two weeks of daily Study Hall."
                      : "For families using Study Hall frequently — roughly four weeks of daily Study Hall."}
                  </p>
                  {pkg.savingsCents > 0 ? (
                    <p className="mt-3 inline-flex w-fit items-center rounded-full bg-forest-50 px-2.5 py-0.5 text-xs font-semibold text-forest-700">
                      Save {formatCents(pkg.savingsCents)} vs. {formatUsd(PAYG_PRICE_USD)}/hour
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
