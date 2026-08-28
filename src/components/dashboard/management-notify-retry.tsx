"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

export function ManagementNotifyRetry({ deliveryId }: { deliveryId: string }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function retry() {
    setBusy(true);
    setNote(null);
    const res = await fetch("/api/admin/notifications/retry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deliveryId }),
    });
    const data = await res.json().catch(() => null);
    setBusy(false);
    if (res.ok && data?.retried) {
      setNote(data.status === "sent" ? "Notification resent." : `Retry recorded (${data.status}).`);
    } else {
      setNote(data?.reason ?? data?.error ?? "Retry failed.");
    }
  }

  return (
    <span className="ml-2 inline-flex items-center gap-2">
      <Button type="button" variant="outline" size="sm" onClick={retry} disabled={busy}>
        {busy ? "Retrying…" : "Retry"}
      </Button>
      {note ? <span className="text-xs text-ink-500">{note}</span> : null}
    </span>
  );
}
