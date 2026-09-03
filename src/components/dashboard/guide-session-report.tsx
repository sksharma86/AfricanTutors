"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";

import {
  FOCUS_LABELS,
  FOCUS_RATINGS,
  GUIDE_NOTE_MAX,
  REDIRECTION_LABELS,
  REDIRECTION_LEVELS,
  WORK_COMPLETED_HINT,
  WORK_COMPLETED_PLACEHOLDER,
  WORK_SUMMARY_MAX,
  type FocusRating,
  type RedirectionLevel,
} from "@/lib/session-report.mjs";

const FIELD_CLASS =
  "gp-field mt-1 w-full rounded-lg border border-ink-200 bg-[var(--gp-card)] px-2 py-1.5 text-xs text-[var(--gp-ink)] placeholder:text-[var(--gp-muted)] caret-[var(--gp-ink)] outline-none focus:border-[#c9a227] focus:shadow-[0_0_0_3px_rgba(201,162,39,0.18)] disabled:bg-ink-100 disabled:text-ink-400 disabled:caret-ink-400";

type ChildTarget = { id: string; firstName: string };

type ChildDraft = {
  studentId: string;
  firstName: string;
  focus: FocusRating | "";
  work: string;
  redirection: RedirectionLevel | "";
  note: string;
};

/**
 * Quick post-session report form for Guides (~30–60 seconds per child).
 * One-child Study Halls keep the original simple form.
 * Multi-child Study Halls use one workflow with a short section per child.
 */
export function GuideSessionReport({
  bookingId,
  childName,
  childList = [],
  alreadySubmitted,
  variant = "inline",
}: {
  bookingId: string;
  childName?: string | null;
  childList?: ChildTarget[];
  alreadySubmitted: boolean;
  variant?: "inline" | "page";
}) {
  const router = useRouter();
  const submittingRef = useRef(false);
  const multi = childList.length > 1;
  const [open, setOpen] = useState(variant === "page");
  const [focus, setFocus] = useState<FocusRating | "">("");
  const [work, setWork] = useState("");
  const [redirection, setRedirection] = useState<RedirectionLevel | "">("");
  const [note, setNote] = useState("");
  const [drafts, setDrafts] = useState<ChildDraft[]>(() =>
    childList.map((c) => ({
      studentId: c.id,
      firstName: c.firstName,
      focus: "",
      work: "",
      redirection: "",
      note: "",
    })),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(alreadySubmitted);

  if (submitted) {
    return <span className="text-xs font-medium text-forest-700">Report submitted</span>;
  }

  function updateDraft(studentId: string, patch: Partial<ChildDraft>) {
    setDrafts((prev) => prev.map((d) => (d.studentId === studentId ? { ...d, ...patch } : d)));
  }

  async function submit() {
    if (multi) {
      const incomplete = drafts.some((d) => !d.focus || !d.redirection || !d.work.trim());
      if (incomplete) {
        setError("Focus, what they worked on, and redirection are required for each child.");
        return;
      }
    } else if (!focus || !redirection || !work.trim()) {
      setError("Focus, what they worked on, and redirection are required.");
      return;
    }
    if (submittingRef.current) return;
    submittingRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const payload = multi
        ? {
            bookingId,
            childReports: drafts.map((d) => ({
              studentId: d.studentId,
              focusRating: d.focus,
              workSummary: d.work.trim(),
              redirectionLevel: d.redirection,
              guideNote: d.note.trim() || null,
            })),
          }
        : {
            bookingId,
            focusRating: focus,
            workSummary: work.trim(),
            redirectionLevel: redirection,
            guideNote: note.trim() || null,
          };
      const res = await fetch("/api/tutor/session-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Unable to submit.");
        return;
      }
      setSubmitted(true);
      setOpen(false);
      if (variant === "page") router.push("/dashboard/tutor");
      else router.refresh();
    } finally {
      setBusy(false);
      submittingRef.current = false;
    }
  }

  return (
    <div className={variant === "page" ? "w-full" : "flex flex-col items-start gap-1.5 sm:items-end"}>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-lg bg-ink-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-ink-800"
        >
          Complete report
        </button>
      ) : (
        <div className={variant === "page" ? "w-full bg-[var(--gp-card)] text-left text-[var(--gp-ink)]" : "w-full max-w-sm rounded-xl border border-ink-200 bg-white p-3 text-left shadow-sm sm:w-80"}>
          <p className="text-xs font-semibold text-ink-800">
            {multi
              ? "How did Study Hall go for each child?"
              : `How did Study Hall go${childName ? ` for ${childName}` : ""}?`}
          </p>
          <p className="mt-0.5 text-[11px] text-ink-400">
            {multi
              ? "A short note for each child — about 30–60 seconds each."
              : "Short accountability note for the parent — not a grade."}
          </p>

          {multi
            ? drafts.map((d, i) => (
                <ChildFields
                  key={d.studentId}
                  draft={d}
                  bookingId={bookingId}
                  heading={d.firstName}
                  first={i === 0}
                  onChange={(patch) => updateDraft(d.studentId, patch)}
                />
              ))
            : (
              <ChildFields
                draft={{
                  studentId: bookingId,
                  firstName: childName || "Child",
                  focus,
                  work,
                  redirection,
                  note,
                }}
                bookingId={bookingId}
                heading={null}
                first
                onChange={(patch) => {
                  if (patch.focus !== undefined) setFocus(patch.focus);
                  if (patch.work !== undefined) setWork(patch.work);
                  if (patch.redirection !== undefined) setRedirection(patch.redirection);
                  if (patch.note !== undefined) setNote(patch.note);
                }}
              />
            )}

          <div className="mt-3 flex gap-2">
            <Button type="button" onClick={submit} disabled={busy} variant="primary" size="sm" className="flex-1">
              {busy ? "Submitting…" : "Submit report"}
            </Button>
            {variant === "inline" ? (
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={busy}
                className="rounded-lg border border-ink-200 px-3 py-1.5 text-xs font-medium text-ink-600 hover:bg-ink-50"
              >
                Cancel
              </button>
            ) : null}
          </div>
          {error ? <p className="mt-1.5 text-xs text-red-600">{error}</p> : null}
        </div>
      )}
    </div>
  );
}

function ChildFields({
  draft,
  bookingId,
  heading,
  first,
  onChange,
}: {
  draft: ChildDraft;
  bookingId: string;
  heading: string | null;
  first: boolean;
  onChange: (patch: Partial<ChildDraft>) => void;
}) {
  return (
    <div className={first ? "" : "mt-5 border-t border-ink-100 pt-4"}>
      {heading ? <p className="text-sm font-semibold text-ink-900">{heading}</p> : null}

      <fieldset className="mt-3">
        <legend className="text-[11px] font-medium tracking-wide text-ink-500 uppercase">
          Focus — How focused was the child?
        </legend>
        <div className="mt-1.5 space-y-1.5">
          {FOCUS_RATINGS.map((value) => (
            <label key={value} className="flex cursor-pointer items-center gap-2 text-xs text-ink-700">
              <input
                type="radio"
                name={`focus-${bookingId}-${draft.studentId}`}
                value={value}
                checked={draft.focus === value}
                onChange={() => onChange({ focus: value })}
                className="accent-ink-900"
              />
              {value === "great_focus"
                ? "Great"
                : value === "good_focus"
                  ? "Good"
                  : value === "difficult_session"
                    ? "Had difficulty staying focused"
                    : FOCUS_LABELS[value]}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="mt-3 block">
        <span className="text-[11px] font-medium tracking-wide text-ink-500 uppercase">What did they work on?</span>
        <textarea
          value={draft.work}
          onChange={(e) => onChange({ work: e.target.value.slice(0, WORK_SUMMARY_MAX) })}
          rows={2}
          maxLength={WORK_SUMMARY_MAX}
          placeholder={WORK_COMPLETED_PLACEHOLDER}
          className={FIELD_CLASS}
        />
        <span className="mt-0.5 block text-[10px] text-ink-400">{WORK_COMPLETED_HINT}</span>
        <span className="mt-0.5 block text-right text-[10px] text-ink-400">
          {draft.work.length}/{WORK_SUMMARY_MAX}
        </span>
      </label>

      <fieldset className="mt-2">
        <legend className="text-[11px] font-medium tracking-wide text-ink-500 uppercase">Redirection</legend>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {REDIRECTION_LEVELS.map((value) => (
            <label
              key={value}
              className={`cursor-pointer rounded-lg border px-2.5 py-1 text-xs ${
                draft.redirection === value
                  ? "border-ink-900 bg-ink-900 text-white"
                  : "border-ink-200 bg-white text-ink-700 hover:border-ink-300"
              }`}
            >
              <input
                type="radio"
                name={`redir-${bookingId}-${draft.studentId}`}
                value={value}
                checked={draft.redirection === value}
                onChange={() => onChange({ redirection: value })}
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
          value={draft.note}
          onChange={(e) => onChange({ note: e.target.value.slice(0, GUIDE_NOTE_MAX) })}
          rows={2}
          maxLength={GUIDE_NOTE_MAX}
          placeholder="Optional short note"
          className={FIELD_CLASS}
        />
      </label>
    </div>
  );
}
