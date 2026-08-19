"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const CATEGORIES: { value: string; label: string }[] = [
  { value: "unprepared", label: "Tutor seemed unprepared" },
  { value: "quality", label: "Poor instruction quality" },
  { value: "behavior", label: "Inappropriate behavior" },
  { value: "no_value", label: "Session provided no real tutoring" },
  { value: "other", label: "Other concern" },
];

export function CustomerBookingActions({
  bookingId,
  canCancel,
  canDispute,
}: {
  bookingId: string;
  canCancel: boolean;
  canDispute: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [showDispute, setShowDispute] = useState(false);
  const [category, setCategory] = useState("quality");
  const [complaint, setComplaint] = useState("");

  async function cancel() {
    if (!window.confirm("Cancel this session? Cancellations 24+ hours ahead return value to your account; later cancellations are non-refundable.")) return;
    setBusy(true);
    setNote(null);
    const res = await fetch("/api/bookings/cancel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bookingId }) });
    const data = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) { setNote(data?.error ?? "Unable to cancel."); return; }
    if (data.early) {
      setNote(
        data.restored_minutes ? `Cancelled. ${data.restored_minutes} package minutes returned to your account.`
          : data.restored_credit_cents ? `Cancelled. $${(data.restored_credit_cents / 100).toFixed(2)} account credit returned.`
            : "Cancelled and value returned to your account.",
      );
    } else {
      setNote("Cancelled. As this was within 24 hours, the session is non-refundable.");
    }
    router.refresh();
  }

  async function submitDispute() {
    setBusy(true);
    setNote(null);
    const res = await fetch("/api/disputes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bookingId, category, complaint: complaint.trim() || null }) });
    const data = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) { setNote(data?.error ?? "Unable to submit."); return; }
    setShowDispute(false);
    setNote("Thanks — we received your concern and will review it.");
    router.refresh();
  }

  return (
    <div className="mt-2 flex flex-col items-end gap-1.5">
      <div className="flex gap-3">
        {canCancel ? (
          <button onClick={cancel} disabled={busy} className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50">Cancel</button>
        ) : null}
        {canDispute ? (
          <button onClick={() => setShowDispute((s) => !s)} disabled={busy} className="text-xs font-medium text-ink-600 hover:underline disabled:opacity-50">Report an issue</button>
        ) : null}
      </div>
      {showDispute ? (
        <div className="mt-1 w-72 rounded-lg border border-ink-200 bg-white p-3 text-left shadow-sm">
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-lg border border-ink-200 px-2 py-1.5 text-xs">
            {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <textarea value={complaint} onChange={(e) => setComplaint(e.target.value)} rows={3} placeholder="Tell us what happened (optional)" className="mt-2 w-full rounded-lg border border-ink-200 px-2 py-1.5 text-xs" />
          <button onClick={submitDispute} disabled={busy} className="mt-2 w-full rounded-lg bg-ink-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-ink-800 disabled:opacity-50">{busy ? "Submitting…" : "Submit concern"}</button>
        </div>
      ) : null}
      {note ? <p className="max-w-[16rem] text-right text-xs text-ink-500">{note}</p> : null}
    </div>
  );
}
