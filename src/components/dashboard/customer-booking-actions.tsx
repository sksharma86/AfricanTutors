"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const CATEGORIES: { value: string; label: string }[] = [
  { value: "quality", label: "The instruction wasn't helpful" },
  { value: "unprepared", label: "The Guide seemed unprepared" },
  { value: "no_value", label: "The session wasn't properly supervised" },
  { value: "behavior", label: "Something felt inappropriate" },
  { value: "other", label: "Something else" },
];

function friendly(message?: string | null): string {
  if (!message) return "Something went wrong. Please try again.";
  return message;
}

export function CustomerBookingActions({
  bookingId,
  canCancel,
  canDispute,
  scheduledStartISO,
}: {
  bookingId: string;
  canCancel: boolean;
  canDispute: boolean;
  scheduledStartISO?: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [within24, setWithin24] = useState(false);
  const [showDispute, setShowDispute] = useState(false);
  const [category, setCategory] = useState("quality");
  const [complaint, setComplaint] = useState("");

  function openCancel() {
    // Time read happens in an event handler, never during render.
    const hoursUntil = scheduledStartISO
      ? (new Date(scheduledStartISO).getTime() - Date.now()) / 3_600_000
      : null;
    setWithin24(hoursUntil !== null && hoursUntil < 24);
    setConfirmingCancel(true);
  }

  async function cancel() {
    setBusy(true);
    setNote(null);
    const res = await fetch("/api/bookings/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingId }),
    });
    const data = await res.json().catch(() => null);
    setBusy(false);
    setConfirmingCancel(false);
    if (!res.ok) {
      setNote(friendly(data?.error));
      return;
    }
    if (data.early) {
      setNote(
        data.restored_minutes
          ? `Cancelled — ${data.restored_minutes} minutes returned to your Study Hall balance.`
          : data.restored_credit_cents
            ? `Cancelled — $${(data.restored_credit_cents / 100).toFixed(2)} returned as account credit.`
            : "Cancelled — the session value was returned to your account.",
      );
    } else {
      setNote("Cancelled. As this was within 24 hours, the session value was not returned.");
    }
    router.refresh();
  }

  async function submitDispute() {
    setBusy(true);
    setNote(null);
    const res = await fetch("/api/disputes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingId, category, complaint: complaint.trim() || null }),
    });
    const data = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) {
      setNote(friendly(data?.error));
      return;
    }
    setShowDispute(false);
    setNote("Thanks — we've received your report and our team will review it.");
    router.refresh();
  }

  const linkBtn = "text-xs font-medium hover:underline disabled:opacity-50";

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-4">
        {canCancel && !confirmingCancel ? (
          <button onClick={openCancel} disabled={busy} className={`${linkBtn} text-ink-500`}>
            Cancel session
          </button>
        ) : null}
        {canDispute ? (
          <button onClick={() => setShowDispute((s) => !s)} disabled={busy} className={`${linkBtn} text-ink-600`}>
            Report an issue
          </button>
        ) : null}
      </div>

      {confirmingCancel ? (
        <div className="w-full max-w-sm rounded-xl border border-ink-200 bg-white p-3.5 text-left shadow-sm">
          <p className="text-sm font-medium text-ink-900">Cancel this session?</p>
          <p className="mt-1 text-xs leading-5 text-ink-500">
            {within24
              ? "This session starts within 24 hours, so cancelling will forfeit the session value."
              : "Cancelling 24+ hours ahead returns the session value to your account, per our policy."}
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={cancel}
              disabled={busy}
              className="rounded-lg bg-ink-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-ink-800 disabled:opacity-50"
            >
              {busy ? "Cancelling…" : "Yes, cancel"}
            </button>
            <button
              onClick={() => setConfirmingCancel(false)}
              disabled={busy}
              className="rounded-lg border border-ink-200 px-3 py-1.5 text-xs font-medium text-ink-700 hover:bg-ink-50"
            >
              Keep session
            </button>
          </div>
        </div>
      ) : null}

      {showDispute ? (
        <div className="w-full max-w-sm rounded-xl border border-ink-200 bg-white p-3.5 text-left shadow-sm">
          <p className="text-sm font-medium text-ink-900">Report an issue with this session</p>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="mt-2 w-full rounded-lg border border-ink-200 px-2.5 py-2 text-sm"
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          <textarea
            value={complaint}
            onChange={(e) => setComplaint(e.target.value)}
            rows={3}
            placeholder="Add any details (optional)"
            className="mt-2 w-full rounded-lg border border-ink-200 px-2.5 py-2 text-sm"
          />
          <button
            onClick={submitDispute}
            disabled={busy}
            className="mt-2 w-full rounded-lg bg-ink-900 px-3 py-2 text-xs font-semibold text-white hover:bg-ink-800 disabled:opacity-50"
          >
            {busy ? "Sending…" : "Submit report"}
          </button>
        </div>
      ) : null}

      {note ? <p className="max-w-sm text-right text-xs text-ink-500">{note}</p> : null}
    </div>
  );
}
