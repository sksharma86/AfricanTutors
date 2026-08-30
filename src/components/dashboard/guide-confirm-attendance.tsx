"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

export function GuideConfirmAttendance({
  bookingId,
  prominent = false,
  count = 1,
}: {
  bookingId: string;
  prominent?: boolean;
  count?: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneCount, setDoneCount] = useState<number | null>(null);

  async function confirm() {
    setError(null);
    setBusy(true);
    const res = await fetch("/api/tutor/attendance-confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingId }),
    });
    const data = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) {
      setError(data?.error ?? "Unable to confirm attendance.");
      return;
    }
    const confirmed = Array.isArray(data?.confirmed) ? data.confirmed.length : count;
    setDoneCount(confirmed > 0 ? confirmed : count);
    router.refresh();
  }

  if (doneCount != null) {
    const label = doneCount > 1 ? `✓ Attendance confirmed for all ${doneCount}` : "✓ Attendance confirmed";
    return <p className={prominent ? "text-sm font-medium text-gold-200" : "text-sm font-medium text-ink-800"}>{label}</p>;
  }

  const action = count > 1 ? `Confirm all ${count}` : "I'll be there";
  return (
    <div className="space-y-2">
      {error ? <p className="text-sm text-red-200">{error}</p> : null}
      <Button type="button" variant="secondary" size={prominent ? "lg" : "sm"} onClick={confirm} disabled={busy}>
        {busy ? "Confirming…" : action}
      </Button>
    </div>
  );
}
