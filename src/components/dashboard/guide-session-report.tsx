"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  FOCUS_LABELS,
  FOCUS_RATINGS,
  GUIDE_NOTE_MAX,
  REDIRECTION_LABELS,
  REDIRECTION_LEVELS,
  WORK_SUMMARY_MAX,
  type FocusRating,
  type RedirectionLevel,
} from "@/lib/session-report.mjs";

/**
 * Quick post-session report form for Guides (~30–60 seconds).
 * Final on submit — no edit path in PR6.
 */
export function GuideSessionReport({
  bookingId,
  childName,
  alreadySubmitted,
}: {
  bookingId: string;
  childName?: string | null;
  alreadySubmitted: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [focus, setFocus] = useState<FocusRating | "">("");
  const [work, setWork] = useState("");
  const [redirection, setRedirection] = useState<RedirectionLevel | "">("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(alreadySubmitted);

  if (submitted) {
    return <span className="text-xs font-medium text-forest-700">Report submitted</span>;
  }

  async function submit() {
    if (!focus || !redirection || !work.trim()) {
      setError("Focus, what they worked on, and redirection are required.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch("/api/tutor/session-report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bookingId,
        focusRating: focus,
        workSummary: work.trim(),
        redirectionLevel: redirection,
        guideNote: note.trim() || null,
      }),
    });
    const data = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) {
      setError(data?.error ?? "Unable to submit.");
      return;
    }
    setSubmitted(true);
    setOpen(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col items-start gap-1.5 sm:items-end">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-lg bg-ink-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-ink-800"
        >
          Complete report
        </button>
      ) : (
        <div className="w-full max-w-sm rounded-xl border border-ink-200 bg-white p-3 text-left shadow-sm sm:w-80">
          <p className="text-xs font-semibold text-ink-800">
            How did Study Hall go{childName ? ` for ${childName}` : ""}?
          </p>
          <p className="mt-0.5 text-[11px] text-ink-400">Short accountability note for the parent — not a grade.</p>

          <fieldset className="mt-3">
            <legend className="text-[11px] font-medium tracking-wide text-ink-500 uppercase">Focus / engagement</legend>
            <div className="mt-1.5 space-y-1.5">
              {FOCUS_RATINGS.map((value) => (
                <label key={value} className="flex cursor-pointer items-center gap-2 text-xs text-ink-700">
                  <input
                    type="radio"
                    name={`focus-${bookingId}`}
                    value={value}
                    checked={focus === value}
                    onChange={() => setFocus(value)}
                    className="accent-ink-900"
                  />
                  {FOCUS_LABELS[value]}
                </label>
              ))}
            </div>
          </fieldset>

          <label className="mt-3 block">
            <span className="text-[11px] font-medium tracking-wide text-ink-500 uppercase">What did they work on?</span>
            <textarea
              value={work}
              onChange={(e) => setWork(e.target.value.slice(0, WORK_SUMMARY_MAX))}
              rows={2}
              maxLength={WORK_SUMMARY_MAX}
              placeholder="e.g. Math worksheet, reading chapter 4"
              className="mt-1 w-full rounded-lg border border-ink-200 px-2 py-1.5 text-xs text-ink-800"
            />
            <span className="mt-0.5 block text-right text-[10px] text-ink-400">
              {work.length}/{WORK_SUMMARY_MAX}
            </span>
          </label>

          <fieldset className="mt-2">
            <legend className="text-[11px] font-medium tracking-wide text-ink-500 uppercase">Redirection</legend>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {REDIRECTION_LEVELS.map((value) => (
                <label
                  key={value}
                  className={`cursor-pointer rounded-lg border px-2.5 py-1 text-xs ${
                    redirection === value
                      ? "border-ink-900 bg-ink-900 text-white"
                      : "border-ink-200 bg-white text-ink-700 hover:border-ink-300"
                  }`}
                >
                  <input
                    type="radio"
                    name={`redir-${bookingId}`}
                    value={value}
                    checked={redirection === value}
                    onChange={() => setRedirection(value)}
                    className="sr-only"
                  />
                  {REDIRECTION_LABELS[value]}
                </label>
              ))}
            </div>
          </fieldset>

          <label className="mt-3 block">
            <span className="text-[11px] font-medium tracking-wide text-ink-500 uppercase">
              Note for parent (optional)
            </span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, GUIDE_NOTE_MAX))}
              rows={2}
              maxLength={GUIDE_NOTE_MAX}
              placeholder="Optional short note"
              className="mt-1 w-full rounded-lg border border-ink-200 px-2 py-1.5 text-xs text-ink-800"
            />
          </label>

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={submit}
              disabled={busy}
              className="flex-1 rounded-lg bg-ink-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-ink-800 disabled:opacity-50"
            >
              {busy ? "Submitting…" : "Submit report"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={busy}
              className="rounded-lg border border-ink-200 px-3 py-1.5 text-xs font-medium text-ink-600 hover:bg-ink-50"
            >
              Cancel
            </button>
          </div>
          {error ? <p className="mt-1.5 text-xs text-red-600">{error}</p> : null}
        </div>
      )}
    </div>
  );
}
