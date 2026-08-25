"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Guide marks themselves unavailable for an upcoming Study Hall.
 * The server records the request and attempts automatic reassignment to another
 * eligible Guide (continuous availability for the full interval). Financial
 * release remains admin-only when auto-reassignment fails.
 */
export function TutorCancelRequest({ bookingId, alreadyRequested }: { bookingId: string; alreadyRequested: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<"open" | "reassigned" | null>(alreadyRequested ? "open" : null);

  if (outcome === "reassigned") {
    return (
      <span className="text-xs font-medium text-forest-700">Replacement assigned — you are off this Study Hall</span>
    );
  }
  if (outcome === "open") {
    return <span className="text-xs font-medium text-amber-700">Coverage pending — awaiting admin</span>;
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
    setOutcome(data?.status === "reassigned" ? "reassigned" : "open");
    setOpen(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button onClick={() => setOpen((o) => !o)} className="text-xs font-medium text-red-600 hover:underline">
        {open ? "Cancel" : "Unavailable for this session?"}
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
            {busy ? "Finding a replacement…" : "I'm unavailable"}
          </button>
          <p className="mt-1 text-[11px] text-ink-400">
            We&apos;ll try to assign another Guide automatically. If none is available, admin is notified.
          </p>
        </div>
      ) : null}
      {note ? <p className="text-xs text-red-600">{note}</p> : null}
    </div>
  );
}
