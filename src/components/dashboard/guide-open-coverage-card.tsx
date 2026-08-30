"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { claimResultMessage } from "@/lib/open-coverage.mjs";

export function GuideOpenCoverageCard({
  bookingId,
  timeLabel,
  durationLabel,
  state = "open",
  message = null,
}: {
  bookingId: string;
  timeLabel: string;
  durationLabel: string;
  state?: "open" | "accepted" | "covered";
  message?: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<"open" | "accepted" | "covered">(state);
  const [copy, setCopy] = useState(message);

  async function accept() {
    if (result !== "open") return;
    setBusy(true);
    const res = await fetch("/api/tutor/open-coverage/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingId }),
    });
    const data = await res.json().catch(() => null);
    setBusy(false);
    if (data?.ok) {
      setResult("accepted");
      setCopy(data.message ?? claimResultMessage("won"));
      router.refresh();
      return;
    }
    setResult("covered");
    setCopy(data?.message ?? claimResultMessage("already_covered"));
  }

  return (
    <section className="mx-auto max-w-md rounded-2xl border border-[#e6e0d4] bg-white px-5 py-6">
      <p className="text-[10px] font-semibold tracking-[0.16em] text-[#8a8174] uppercase">Open Study Hall</p>
      <p className="mt-3 font-display text-[1.45rem] font-semibold tracking-[-0.03em] text-[var(--gp-ink)]">
        {timeLabel}
      </p>
      <p className="mt-1 text-sm text-[#6f675c]">{durationLabel}</p>
      {result === "open" ? (
        <>
          <p className="mt-4 text-sm text-[#3f3a33]">Available for immediate assignment.</p>
          <div className="mt-5">
            <Button type="button" variant="secondary" size="lg" onClick={accept} disabled={busy} className="w-full">
              {busy ? "Accepting…" : "Accept session"}
            </Button>
          </div>
        </>
      ) : (
        <p className="mt-4 text-sm font-medium text-[var(--gp-ink)]">
          {copy ?? (result === "accepted" ? claimResultMessage("won") : claimResultMessage("already_covered"))}
        </p>
      )}
    </section>
  );
}
