"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Container } from "@/components/ui/container";

interface Status {
  uiState: "confirming" | "confirmed" | "completed" | "failed" | "expired" | "credited";
  message: string;
  purpose: string;
  booking?: { reference: string | null; status: string } | null;
}

const TONE: Record<Status["uiState"], string> = {
  confirming: "border-ink-200 bg-ink-50 text-ink-700",
  confirmed: "border-gold-200 bg-gold-50 text-gold-800",
  completed: "border-gold-200 bg-gold-50 text-gold-800",
  credited: "border-amber-300 bg-amber-50 text-amber-800",
  failed: "border-red-200 bg-red-50 text-red-700",
  expired: "border-red-200 bg-red-50 text-red-700",
};

const HEADING: Record<Status["uiState"], string> = {
  confirming: "Confirming your payment…",
  confirmed: "Session confirmed",
  completed: "Package activated",
  credited: "Payment credited to your account",
  failed: "Payment not completed",
  expired: "Booking expired",
};

export function CheckoutReturnView() {
  const params = useSearchParams();
  const paymentId = params.get("payment");
  const canceled = params.get("canceled") === "1";

  const [status, setStatus] = useState<Status | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const error = fetchError ?? (!paymentId ? "Missing payment reference." : null);

  useEffect(() => {
    if (!paymentId) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;

    async function poll(count: number) {
      try {
        const res = await fetch(`/api/checkout/status?payment=${paymentId}`, { cache: "no-store" });
        const data = await res.json();
        if (!active) return;
        if (!res.ok) {
          setFetchError("We couldn't load your payment status.");
          return;
        }
        setStatus(data as Status);
        setAttempts(count);
        // Keep polling while the webhook may still be arriving.
        if ((data.uiState === "confirming") && count < 20) {
          timer = setTimeout(() => poll(count + 1), 3000);
        }
      } catch {
        if (active) setFetchError("We couldn't load your payment status.");
      }
    }
    poll(0);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [paymentId]);

  return (
    <div className="min-h-full bg-ink-50/50 py-16">
      <Container className="max-w-xl">
        <div className="rounded-2xl border border-ink-100 bg-white p-8">
          {error ? (
            <>
              <h1 className="font-display text-2xl font-semibold text-ink-900">Something went wrong</h1>
              <p className="mt-2 text-sm text-ink-600">{error}</p>
            </>
          ) : !status ? (
            <>
              <h1 className="font-display text-2xl font-semibold text-ink-900">Checking your payment…</h1>
              <p className="mt-2 text-sm text-ink-600">
                We&apos;re verifying your payment with our records. This won&apos;t take long.
              </p>
            </>
          ) : (
            <>
              <div className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${TONE[status.uiState]}`}>
                {HEADING[status.uiState]}
              </div>
              <h1 className="mt-4 font-display text-2xl font-semibold text-ink-900">{HEADING[status.uiState]}</h1>
              <p className="mt-2 text-sm leading-6 text-ink-600">{status.message}</p>
              {status.uiState === "confirming" ? (
                <p className="mt-3 text-xs text-ink-400">
                  Checking again automatically… (attempt {attempts + 1}). You don&apos;t need to pay again.
                </p>
              ) : null}
              {canceled && status.uiState !== "confirmed" && status.uiState !== "completed" ? (
                <p className="mt-3 text-xs text-ink-400">You canceled at the payment step. Nothing was charged.</p>
              ) : null}
              {status.booking?.reference ? (
                <p className="mt-4 text-sm text-ink-500">
                  Reference: <span className="font-mono font-medium text-ink-800">{status.booking.reference}</span>
                </p>
              ) : null}
            </>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/dashboard/student"
              className="rounded-lg bg-ink-900 px-4 py-2 text-sm font-medium text-white hover:bg-ink-800"
            >
              Go to dashboard
            </Link>
            {status?.purpose === "package" ? (
              <Link
                href="/dashboard/student/packages#prepaid"
                className="rounded-lg border border-ink-200 px-4 py-2 text-sm font-medium text-ink-700 hover:border-ink-300"
              >
                View prepaid hours
              </Link>
            ) : (
              <Link
                href="/dashboard/student/book"
                className="rounded-lg border border-ink-200 px-4 py-2 text-sm font-medium text-ink-700 hover:border-ink-300"
              >
                Book another Study Hall
              </Link>
            )}
          </div>
        </div>
      </Container>
    </div>
  );
}
