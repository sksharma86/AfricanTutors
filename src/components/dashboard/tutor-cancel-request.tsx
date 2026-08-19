"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Lets a tutor request to be released from an upcoming session. This records
 * intent + a reason and alerts admin; it performs no financial action or
 * reassignment (admin resolves). If a request is already open, shows that state.
 */
export function TutorCancelRequest({ bookingId, alreadyRequested }: { bookingId: string; alreadyRequested: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [requested, setRequested] = useState(alreadyRequested);

  if (requested) {
    return <span className="text-xs font-medium text-amber-700">Cancellation requested — awaiting admin</span>;
  }

  async function submit() {
    if (!reason.trim()) {
      setNote("Please add a brief reason.");
      return;
    }
    setBusy(true);
    setNote(null);
    const res = await fetch("/api/tutor/cancellation-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingId, reason: reason.trim() }),
    });
    const data = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) {
      setNote(data?.error ?? "Unable to submit.");
      return;
    }
    setRequested(true);
    setOpen(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button onClick={() => setOpen((o) => !o)} className="text-xs font-medium text-red-600 hover:underline">
        {open ? "Cancel" : "Can't attend?"}
      </button>
      {open ? (
        <div className="w-72 rounded-lg border border-ink-200 bg-white p-3 text-left shadow-sm">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="Reason you can't attend (shared with admin only)"
            className="w-full rounded-lg border border-ink-200 px-2 py-1.5 text-xs"
          />
          <button
            onClick={submit}
            disabled={busy}
            className="mt-2 w-full rounded-lg bg-ink-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-ink-800 disabled:opacity-50"
          >
            {busy ? "Submitting…" : "Request cancellation"}
          </button>
          <p className="mt-1 text-[11px] text-ink-400">Admin will arrange a replacement or release the session.</p>
        </div>
      ) : null}
      {note ? <p className="text-xs text-red-600">{note}</p> : null}
    </div>
  );
}
