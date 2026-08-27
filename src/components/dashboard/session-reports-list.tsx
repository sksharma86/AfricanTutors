import {
  FOCUS_LABELS,
  REDIRECTION_LABELS,
  type FocusRating,
  type RedirectionLevel,
} from "@/lib/session-report.mjs";
import { recordingAvailabilityLabel } from "@/lib/recording-retention.mjs";
import { formatStudyHallDuration } from "@/lib/studyhall-duration.mjs";
import { formatDayHeading } from "@/lib/timezone";

import { WatchRecordingButton } from "@/components/dashboard/watch-recording-button";

export type ParentRecordingSummary = {
  id: string;
  status: string;
  retention_until: string | null;
  deleted_at: string | null;
  /** When true, show Watch; when expired/deleted/failed, show neutral copy. */
  playable: boolean;
};

export interface ParentSessionReport {
  id: string;
  booking_id?: string;
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
  /** Optional recording summary for this booking (PR9). */
  recording?: ParentRecordingSummary | null;
}

/**
 * Chronological list of Study Hall accountability reports for the parent portal.
 * Tone: reassuring and practical — not grades or academic assessment.
 * Session recordings complement the Guide report (60-day retention).
 */
export function SessionReportsList({ reports }: { reports: ParentSessionReport[] }) {
  if (reports.length === 0) {
    return (
      <div className="rounded-2xl border-0 px-0 py-4">
        <p className="text-sm font-medium text-ink-700">Reports from completed Study Halls will appear here.</p>
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
            className="rounded-2xl border-0 py-4 sm:flex-col"
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

            <RecordingBlock recording={r.recording ?? null} timezone={tz} />
          </article>
        );
      })}
    </div>
  );
}

function RecordingBlock({
  recording,
  timezone,
}: {
  recording: ParentRecordingSummary | null;
  timezone: string;
}) {
  if (!recording) return null;

  if (recording.status === "failed") {
    return (
      <div className="mt-4 border-t border-ink-100 pt-3">
        <p className="text-[11px] font-medium tracking-wide text-ink-400 uppercase">Session recording</p>
        <p className="mt-0.5 text-sm text-ink-600">Recording unavailable</p>
      </div>
    );
  }

  if (recording.deleted_at || !recording.playable) {
    return (
      <div className="mt-4 border-t border-ink-100 pt-3">
        <p className="text-[11px] font-medium tracking-wide text-ink-400 uppercase">Session recording</p>
        <p className="mt-0.5 text-sm text-ink-600">Recording expired</p>
      </div>
    );
  }

  if (recording.status !== "completed") {
    return (
      <div className="mt-4 border-t border-ink-100 pt-3">
        <p className="text-[11px] font-medium tracking-wide text-ink-400 uppercase">Session recording</p>
        <p className="mt-0.5 text-sm text-ink-600">Recording is processing — check back soon.</p>
      </div>
    );
  }

  void timezone;
  return (
    <div className="mt-4 border-t border-ink-100 pt-3">
      <p className="text-[11px] font-medium tracking-wide text-ink-400 uppercase">Session recording</p>
      <p className="mt-0.5 text-sm text-ink-700">{recordingAvailabilityLabel(recording.retention_until)}</p>
      <WatchRecordingButton recordingId={recording.id} />
    </div>
  );
}
