import {
  FOCUS_LABELS,
  REDIRECTION_LABELS,
  type FocusRating,
  type RedirectionLevel,
} from "@/lib/session-report.mjs";
import { formatStudyHallDuration } from "@/lib/studyhall-duration.mjs";
import { formatDayHeading } from "@/lib/timezone";

export interface ParentSessionReport {
  id: string;
  submitted_at: string;
  focus_rating: FocusRating;
  work_summary: string;
  redirection_level: RedirectionLevel;
  guide_note: string | null;
  child_first_name: string;
  scheduled_start: string | null;
  duration_minutes: number | null;
  timezone: string;
  /** True when a Call Parent escalation occurred for this booking (PR7). */
  had_parent_escalation?: boolean;
}

/**
 * Chronological list of Study Hall accountability reports for the parent portal.
 * Tone: reassuring and practical — not grades or academic assessment.
 */
export function SessionReportsList({ reports }: { reports: ParentSessionReport[] }) {
  if (reports.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-ink-200 bg-white px-4 py-8 text-center">
        <p className="text-sm font-medium text-ink-700">No session reports yet</p>
        <p className="mt-1 text-sm text-ink-400">
          After a Study Hall ends, your Guide shares a short note about how the session went.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {reports.map((r) => {
        const tz = r.timezone || "America/Chicago";
        const dateLabel = r.scheduled_start ? formatDayHeading(r.scheduled_start, tz) : "Date pending";
        const duration = formatStudyHallDuration(r.duration_minutes);
        return (
          <article
            key={r.id}
            className="rounded-2xl border border-ink-100 bg-white p-4 shadow-[0_8px_24px_-18px_rgba(19,19,17,0.2)] sm:p-5"
          >
            <header className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
              <h3 className="font-medium text-ink-900">{r.child_first_name}&apos;s Study Hall</h3>
              <p className="text-sm text-ink-500">
                {dateLabel}
                {duration !== "—" ? <span className="text-ink-400"> · {duration}</span> : null}
              </p>
            </header>

            {r.had_parent_escalation ? (
              <p className="mt-2 text-xs font-medium text-ink-600">
                A parent attention request was sent during this session.
              </p>
            ) : null}

            <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-[11px] font-medium tracking-wide text-ink-400 uppercase">Focus</dt>
                <dd className="mt-0.5 text-ink-800">{FOCUS_LABELS[r.focus_rating] ?? r.focus_rating}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium tracking-wide text-ink-400 uppercase">Redirection</dt>
                <dd className="mt-0.5 text-ink-800">
                  {REDIRECTION_LABELS[r.redirection_level] ?? r.redirection_level}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-[11px] font-medium tracking-wide text-ink-400 uppercase">
                  What they worked on
                </dt>
                <dd className="mt-0.5 whitespace-pre-wrap text-ink-800">{r.work_summary}</dd>
              </div>
              {r.guide_note ? (
                <div className="sm:col-span-2">
                  <dt className="text-[11px] font-medium tracking-wide text-ink-400 uppercase">
                    Note from Guide
                  </dt>
                  <dd className="mt-0.5 whitespace-pre-wrap text-ink-700">{r.guide_note}</dd>
                </div>
              ) : null}
            </dl>
          </article>
        );
      })}
    </div>
  );
}
