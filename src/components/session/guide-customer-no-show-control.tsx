"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { CallParentControl } from "@/components/session/call-parent-control";
import {
  customerNoShowGuideCopy,
  customerNoShowUiState,
} from "@/lib/guide-customer-no-show.mjs";

export function GuideCustomerNoShowControl({
  bookingId,
  status,
  scheduledStart,
  studentJoinedAt = null,
  paymentStatus = null,
  nowMs,
  callParentEnabled = false,
  includeCallParent = true,
  variant = "session",
}: {
  bookingId: string;
  status: string;
  scheduledStart: string | null;
  studentJoinedAt?: string | null;
  paymentStatus?: string | null;
  nowMs?: number;
  callParentEnabled?: boolean;
  includeCallParent?: boolean;
  variant?: "session" | "home";
}) {
  const router = useRouter();
  const [liveNow, setLiveNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const submittingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    if (nowMs != null) return;
    const id = window.setInterval(() => setLiveNow(Date.now()), 15_000);
    return () => window.clearInterval(id);
  }, [nowMs]);

  const now = nowMs ?? liveNow;
  const ui = customerNoShowUiState({
    status: result ? "no_show" : status,
    scheduledStart,
    studentJoinedAt,
    paymentStatus,
    nowMs: now,
  });
  const copy = customerNoShowGuideCopy(ui.kind);

  if (ui.kind === "ineligible" || ui.kind === "awaiting_payment" || ui.kind === "cancelled" || ui.kind === "completed") {
    return null;
  }
  if (ui.kind === "not_started" || ui.kind === "child_joined") {
    return copy ? <p className="text-[12.5px] leading-5 text-white/70">{copy}</p> : null;
  }

  async function markNoShow() {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/tutor/customer-no-show", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Unable to mark customer no-show.");
        return;
      }
      setResult("recorded");
      router.refresh();
    } finally {
      setBusy(false);
      submittingRef.current = false;
    }
  }

  const tone = variant === "home" ? "text-white/70" : "text-ink-300";

  return (
    <div className="space-y-2" data-noshow-kind={ui.kind}>
      {copy ? <p className={`text-[12.5px] leading-5 ${tone}`}>{copy}</p> : null}
      {ui.kind === "waiting" ? (
        <p className={`text-[12px] ${tone}`}>
          Customer no-show is available 15 minutes after start
          {ui.remainingMin > 0 ? ` · about ${ui.remainingMin} minute${ui.remainingMin === 1 ? "" : "s"} left` : ""}.
        </p>
      ) : null}
      {includeCallParent && ui.callParentPrompt && ui.kind !== "recorded" ? (
        <div className="max-w-sm">
          <p className={`mb-1.5 text-[12px] leading-5 ${tone}`}>
            If the child has not arrived, Call Parent. You will not see their number. A missing number does not block a
            later no-show.
          </p>
          <CallParentControl bookingId={bookingId} enabled={callParentEnabled} />
        </div>
      ) : null}
      {ui.kind === "eligible" ? (
        <button
          type="button"
          onClick={() => void markNoShow()}
          disabled={busy}
          className="rounded-lg border border-white/25 bg-white/8 px-3 py-2 text-xs font-semibold text-white hover:bg-white/12 disabled:opacity-50"
        >
          {busy ? "Recording…" : "Mark customer no-show"}
        </button>
      ) : null}
      {ui.kind === "recorded" ? (
        <p className="text-[12.5px] font-medium text-gold-200">Customer no-show recorded. No report is required.</p>
      ) : null}
      {error ? <p className="text-xs text-red-300">{error}</p> : null}
    </div>
  );
}
