"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

export function ManagementRecordingAccess({
  id,
  minutes,
}: {
  id: string;
  minutes: number | null;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function open() {
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/admin/recording/access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recordingId: id }),
    });
    const data = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok || !data?.url) {
      setErr(data?.error ?? "Could not open the recording.");
      return;
    }
    window.open(data.url as string, "_blank", "noopener,noreferrer");
  }

  return (
    <div>
      <Button type="button" variant="outline" size="sm" onClick={open} disabled={busy}>
        {busy ? "Opening…" : `Review recording${minutes != null ? ` · ${minutes} min` : ""}`}
      </Button>
      {err ? <p className="mt-1 text-xs text-red-600">{err}</p> : null}
    </div>
  );
}
