"use client";

import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { STUDY_HALL_365_MONTHLY_USD } from "@/lib/study-hall-365/catalog.mjs";

export type StudyHall365Membership = {
  status: string;
  entitled: boolean;
  cancelAtPeriodEnd: boolean;
  periodEnd: string;
} | null;

function periodLabel(iso: string) {
  try {
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function StudyHall365Card({ membership }: { membership: StudyHall365Membership }) {
  const [busy, setBusy] = useState<"join" | "portal" | "cancel" | "resume" | null>(null);
  const submittingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  async function post(url: string, body?: unknown) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const payload = await res.json().catch(() => null);
    return { res, payload };
  }

  async function join() {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setBusy("join");
    setError(null);
    try {
      const { res, payload } = await post("/api/checkout/study-hall-365");
      if (!res.ok) {
        setError(payload?.error ?? "Something went wrong. Please try again.");
        return;
      }
      if (payload?.checkoutUrl) {
        window.location.assign(payload.checkoutUrl as string);
        return;
      }
      setError("Checkout did not start. Please try again.");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      submittingRef.current = false;
      setBusy(null);
    }
  }

  async function portal() {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setBusy("portal");
    setError(null);
    try {
      const { res, payload } = await post("/api/billing/portal");
      if (payload?.url) {
        window.location.assign(payload.url as string);
        return;
      }
      setError(payload?.error ?? "Billing portal is not available yet.");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      submittingRef.current = false;
      setBusy(null);
    }
  }

  async function setCancel(action: "cancel" | "resume") {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setBusy(action);
    setError(null);
    try {
      const { res, payload } = await post("/api/billing/membership", { action });
      if (!res.ok) {
        setError(payload?.error ?? "Something went wrong. Please try again.");
        return;
      }
      window.location.reload();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      submittingRef.current = false;
      setBusy(null);
    }
  }

  const active = Boolean(membership?.entitled);
  const hasMembership = Boolean(membership);

  return (
    <Card className="flex flex-col p-6">
      <p className="text-xs font-semibold tracking-wide text-gold-700 uppercase">Study Hall 365</p>
      <p className="mt-1 font-display text-3xl font-semibold text-ink-900">${STUDY_HALL_365_MONTHLY_USD}<span className="text-lg font-medium text-ink-400">/month</span></p>
      <p className="mt-1 text-sm text-ink-500">
        One 60-minute Study Hall each local calendar day while the membership is active. Unused days do not roll over.
      </p>
      {active ? (
        <p className="mt-3 text-sm text-ink-600">
          {membership?.cancelAtPeriodEnd
            ? `Cancellation scheduled. Access continues through ${periodLabel(membership.periodEnd)}.`
            : `Membership is active through ${periodLabel(membership!.periodEnd)}.`}
        </p>
      ) : null}
      {error ? (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      ) : null}
      <div className="mt-auto flex flex-col gap-2 pt-5">
        {active ? (
          <>
            <Button onClick={portal} disabled={busy !== null} variant="outline" className="w-full">
              {busy === "portal" ? "Opening…" : "Manage billing"}
            </Button>
            {membership?.cancelAtPeriodEnd ? (
              <Button onClick={() => setCancel("resume")} disabled={busy !== null} variant="outline" className="w-full">
                {busy === "resume" ? "Updating…" : "Keep membership"}
              </Button>
            ) : (
              <Button onClick={() => setCancel("cancel")} disabled={busy !== null} variant="outline" className="w-full">
                {busy === "cancel" ? "Updating…" : "Cancel at period end"}
              </Button>
            )}
          </>
        ) : (
          <>
            {hasMembership ? (
              <Button onClick={portal} disabled={busy !== null} variant="outline" className="w-full">
                {busy === "portal" ? "Opening…" : "Manage billing"}
              </Button>
            ) : null}
            <Button onClick={join} disabled={busy !== null} variant="secondary" className="w-full">
              {busy === "join" ? "Starting…" : "Join Study Hall 365"}
            </Button>
          </>
        )}
      </div>
    </Card>
  );
}
