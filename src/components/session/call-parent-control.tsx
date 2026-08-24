"use client";

import { useState } from "react";

import {
  ESCALATION_NOTE_MAX,
  ESCALATION_REASON_LABELS,
  ESCALATION_REASONS,
  type EscalationReason,
} from "@/lib/call-parent.mjs";

type GuideStatus = "parent_contacted" | "parent_alerted_sms" | "unable_to_contact" | "not_configured" | null;

/**
 * Guide-only Call Parent control. Confirmation + reason required before the
 * server places an automated call. Never displays a phone number.
 */
export function CallParentControl({
  bookingId,
  enabled,
}: {
  bookingId: string;
  /** True when the session join window is open (active Study Hall). */
  enabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<EscalationReason | "">("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ status: GuideStatus; message: string } | null>(null);

  if (!enabled && !result) {
    return (
      <p className="text-[11px] text-ink-400">
        Call Parent is available while this Study Hall is active.
      </p>
    );
  }

  if (result) {
    const tone =
      result.status === "parent_contacted" || result.status === "parent_alerted_sms"
        ? "text-forest-200"
        : "text-amber-200";
    return <p className={`text-xs font-medium ${tone}`}>{result.message}</p>;
  }

  async function submit() {
    if (!reason) {
      setError("Please choose a reason.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch("/api/tutor/call-parent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bookingId,
        reason,
        note: note.trim() || null,
      }),
    });
    const data = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) {
      setError(data?.error ?? "Unable to contact parent.");
      return;
    }
    setResult({ status: data.status, message: data.message });
    setOpen(false);
  }

  return (
    <div className="flex flex-col items-stretch gap-2">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={!enabled}
          className="rounded-lg border border-ink-500 bg-ink-900 px-3 py-2 text-xs font-semibold text-ink-100 hover:border-gold-400 hover:text-gold-200 disabled:opacity-40"
        >
          Call Parent
        </button>
      ) : (
        <div className="rounded-xl border border-ink-600 bg-ink-900 p-3 text-left">
          <p className="text-xs font-semibold text-ink-100">Request parent attention?</p>
          <p className="mt-1 text-[11px] leading-4 text-ink-400">
            This will contact the parent immediately by phone (text if the call cannot be placed). You will not see
            their number.
          </p>

          <fieldset className="mt-3">
            <legend className="text-[10px] font-medium tracking-wide text-ink-400 uppercase">Reason</legend>
            <div className="mt-1.5 space-y-1.5">
              {ESCALATION_REASONS.map((value) => (
                <label key={value} className="flex cursor-pointer items-center gap-2 text-xs text-ink-200">
                  <input
                    type="radio"
                    name={`escalation-reason-${bookingId}`}
                    value={value}
                    checked={reason === value}
                    onChange={() => setReason(value)}
                    className="accent-gold-400"
                  />
                  {ESCALATION_REASON_LABELS[value]}
                </label>
              ))}
            </div>
          </fieldset>

          <label className="mt-3 block">
            <span className="text-[10px] font-medium tracking-wide text-ink-400 uppercase">
              Short note (optional)
            </span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, ESCALATION_NOTE_MAX))}
              rows={2}
              maxLength={ESCALATION_NOTE_MAX}
              placeholder="Optional context for managers"
              className="mt-1 w-full rounded-lg border border-ink-600 bg-ink-800 px-2 py-1.5 text-xs text-ink-100"
            />
            <span className="mt-0.5 block text-right text-[10px] text-ink-500">
              {note.length}/{ESCALATION_NOTE_MAX}
            </span>
          </label>

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={submit}
              disabled={busy}
              className="flex-1 rounded-lg bg-gold-400 px-3 py-1.5 text-xs font-semibold text-ink-900 hover:bg-gold-300 disabled:opacity-50"
            >
              {busy ? "Contacting…" : "Call Parent"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={busy}
              className="rounded-lg border border-ink-600 px-3 py-1.5 text-xs font-medium text-ink-300"
            >
              Cancel
            </button>
          </div>
          {error ? <p className="mt-1.5 text-xs text-red-300">{error}</p> : null}
        </div>
      )}
    </div>
  );
}
