"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

export function GuideConfirmAttendance({
  bookingId,
  prominent = false,
}: {
  bookingId: string;
  prominent?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

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
    setDone(true);
    router.refresh();
  }

  if (done) {
    return <p className={prominent ? "text-sm font-medium text-gold-200" : "text-sm font-medium text-ink-800"}>✓ Attendance confirmed</p>;
  }

  return (
    <div className="space-y-2">
      {error ? <p className="text-sm text-red-200">{error}</p> : null}
      <Button type="button" variant="secondary" size={prominent ? "lg" : "sm"} onClick={confirm} disabled={busy}>
        {busy ? "Confirming…" : "I'll be there"}
      </Button>
    </div>
  );
}
