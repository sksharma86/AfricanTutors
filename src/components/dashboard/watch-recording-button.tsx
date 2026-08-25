"use client";

import { useState } from "react";

/**
 * Parent "Watch recording" control. Requests a short-lived access link from the
 * server after ownership checks — never embeds permanent Daily URLs.
 */
export function WatchRecordingButton({ recordingId }: { recordingId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function open() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/recording/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordingId }),
      });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setError(data.error ?? "Recording unavailable");
        return;
      }
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch {
      setError("Recording unavailable");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={() => void open()}
        disabled={busy}
        className="text-sm font-medium text-gold-800 underline-offset-2 hover:underline disabled:opacity-60"
      >
        {busy ? "Opening…" : "Watch recording"}
      </button>
      {error ? <p className="mt-1 text-xs text-ink-500">{error}</p> : null}
    </div>
  );
}
