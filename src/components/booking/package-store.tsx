"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { formatCents } from "@/lib/pricing";

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
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ minutes: number } | null>(null);

  async function buy(pkg: PackageRow) {
    setBusyId(pkg.id);
    setError(null);
    let res: Response;
    try {
      res = await fetch("/api/checkout/package", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId: pkg.id }),
      });
    } catch {
      setBusyId(null);
      setError("Something went wrong. Please try again.");
      return;
    }
    const payload = await res.json().catch(() => null);
    if (!res.ok) {
      setBusyId(null);
      setError(friendlyError(payload?.error));
      return;
    }
    if (payload?.checkoutUrl) {
      window.location.assign(payload.checkoutUrl as string);
      return;
    }
    setBusyId(null);
    setDone({ minutes: pkg.minutes });
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-ink-100 bg-white p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gold-50 text-gold-700">
          <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor" className="h-6 w-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
          </svg>
        </div>
        <h2 className="mt-5 font-display text-2xl font-semibold text-ink-900">Package activated</h2>
        <p className="mt-2 text-sm text-ink-600">
          {done.minutes} tutoring minutes were added to your account using your credit. They never expire.
        </p>
        <div className="mt-6">
          <a href="/dashboard/student/book" className="font-medium text-gold-700 hover:underline">
            Book a session →
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {creditCents > 0 ? (
        <p className="rounded-lg border border-gold-200 bg-gold-50 px-3 py-2 text-sm text-ink-600">
          You have <span className="font-medium text-ink-800">{formatCents(creditCents)}</span> account credit. It will be
          applied automatically at checkout.
        </p>
      ) : null}
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-3">
        {packages.map((pkg) => {
          const hours = pkg.minutes / 60;
          const creditUsed = Math.min(creditCents, pkg.price_cents);
          const due = pkg.price_cents - creditUsed;
          return (
            <div key={pkg.id} className="flex flex-col rounded-2xl border border-ink-100 bg-white p-6">
              <p className="text-xs font-semibold tracking-wide text-gold-700 uppercase">
                {Number.isInteger(hours) ? `${hours} hours` : `${hours.toFixed(1)} hours`}
              </p>
              <p className="mt-1 font-display text-3xl font-semibold text-ink-900">{formatCents(pkg.price_cents)}</p>
              <p className="mt-1 text-sm text-ink-500">{pkg.minutes} tutoring minutes · never expire</p>
              {creditUsed > 0 ? (
                <p className="mt-3 text-xs text-ink-500">
                  Credit −{formatCents(creditUsed)} · Due {formatCents(due)}
                </p>
              ) : null}
              <div className="mt-auto pt-5">
                <Button onClick={() => buy(pkg)} disabled={busyId !== null} className="w-full">
                  {busyId === pkg.id ? "Starting…" : due > 0 ? "Buy package" : "Redeem with credit"}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
