"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ANALYTICS_EVENTS, track } from "@/lib/analytics";
import { formatCents, PAYG_PRICE_USD, formatUsd } from "@/lib/pricing";
import { formatMoneyCents } from "@/lib/format.mjs";
import { packageBadge, packageEconomics } from "@/lib/packages.mjs";
import { cn } from "@/lib/utils";

export interface PackageRow {
  id: string;
  name: string;
  minutes: number;
  price_cents: number;
}

const TECHNICAL_ERROR = /permission denied|violates|constraint|null value|relation|column|function|syntax|jwt|supabase|fetch failed|network|policy/i;
function friendlyError(message?: string | null): string {
  if (!message || TECHNICAL_ERROR.test(message)) return "Something went wrong. Please try again.";
  return message;
}

export function PackageStore({
  packages,
  creditCents,
}: {
  packages: PackageRow[];
  creditCents: number;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const submittingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ minutes: number } | null>(null);

  async function buy(pkg: PackageRow) {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setBusyId(pkg.id);
    setError(null);
    track(ANALYTICS_EVENTS.packagePurchaseStarted, { minutes: pkg.minutes });
    let res: Response;
    try {
      res = await fetch("/api/checkout/package", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId: pkg.id }),
      });
    } catch {
      setBusyId(null);
      submittingRef.current = false;
      setError("Something went wrong. Please try again.");
      return;
    }
    const payload = await res.json().catch(() => null);
    if (!res.ok) {
      setBusyId(null);
      submittingRef.current = false;
      setError(friendlyError(payload?.error));
      return;
    }
    if (payload?.checkoutUrl) {
      window.location.assign(payload.checkoutUrl as string);
      return;
    }
    setBusyId(null);
    submittingRef.current = false;
    track(ANALYTICS_EVENTS.packagePurchaseCompleted, { minutes: pkg.minutes });
    setDone({ minutes: pkg.minutes });
    // Credit-redeem path completes without Stripe redirect — refresh balance UI.
    router.refresh();
  }

  if (done) {
    return (
      <Card className="p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-forest-50 text-forest-600">
          <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor" className="h-6 w-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
          </svg>
        </div>
        <h2 className="mt-5 font-display text-2xl font-semibold text-ink-900">Hours added to your account</h2>
        <p className="mt-2 text-sm text-ink-600">
          {done.minutes / 60} hours of Study Hall time were added using your credit. They never expire.
        </p>
        <div className="mt-6">
          <a href="/dashboard/student/book" className="font-medium text-gold-700 hover:underline">
            Book a Study Hall →
          </a>
        </div>
      </Card>
    );
  }

  if (packages.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-ink-200 bg-ink-50/50 px-5 py-8 text-center">
        <p className="text-sm font-medium text-ink-800">Prepaid packages aren’t listed right now</p>
        <p className="mt-1 text-sm text-ink-500">
          You can still book a single Study Hall session anytime. Check back soon for prepaid hours.
        </p>
        <a
          href="/dashboard/student/book"
          className="mt-4 inline-block text-sm font-medium text-ink-800 underline-offset-4 hover:underline"
        >
          Book a Study Hall
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      ) : null}
      <div className={cn("grid gap-4", packages.length <= 2 ? "sm:grid-cols-2" : "sm:grid-cols-3")}>
        {packages.map((pkg) => {
          const { hours, effectiveHourlyCents, savingsCents } = packageEconomics(pkg.minutes, pkg.price_cents);
          const creditUsed = Math.min(creditCents, pkg.price_cents);
          const due = pkg.price_cents - creditUsed;
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
                      featured ? "bg-forest-600 text-white" : "bg-forest-50 text-forest-700",
                    )}
                  >
                    {badge}
                  </span>
                ) : null}
              </div>
              <p className="mt-1 font-display text-3xl font-semibold text-ink-900">{formatCents(pkg.price_cents)}</p>
              <p className="mt-1 text-sm text-ink-500">
                {formatCents(effectiveHourlyCents)}/hour
                {Number.isInteger(hours) ? ` · ${hours} hours` : ` · ${hours.toFixed(1)} hours`}
                {" · never expire"}
              </p>
              {savingsCents > 0 ? (
                <p className="mt-2 inline-flex w-fit items-center rounded-full bg-forest-50 px-2.5 py-0.5 text-xs font-semibold text-forest-700">
                  Save {formatCents(savingsCents)} vs. {formatUsd(PAYG_PRICE_USD)}/hour
                </p>
              ) : null}
              {creditUsed > 0 ? (
                <p className="mt-3 text-xs text-ink-500">
                  Account credit −{formatMoneyCents(creditUsed)} · Due today {formatMoneyCents(due)}
                </p>
              ) : null}
              <div className="mt-auto pt-5">
                <Button
                  onClick={() => buy(pkg)}
                  disabled={busyId !== null}
                  variant={featured ? "primary" : "outline"}
                  className="w-full"
                >
                  {busyId === pkg.id ? "Starting…" : due > 0 ? "Buy hours" : "Redeem with credit"}
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
