import { ParentSurface } from "@/components/dashboard/parent-surface";
import { WatchRecordingButton } from "@/components/dashboard/watch-recording-button";
import { firstNameOf } from "@/lib/household-children.mjs";
import { parentFocusLabel, REDIRECTION_LABELS } from "@/lib/session-report.mjs";
import { recordingAvailabilityLabel } from "@/lib/recording-retention.mjs";
import type { ParentChildReport, ParentReport } from "@/lib/parent-portal-types";

type RecapChild = {
  key: string;
  name: string;
  focus: string;
  work: string;
  redirection: string;
  note: string | null;
};

function recapChildren(report: ParentReport | null): RecapChild[] {
  if (!report) return [];
  if (report.children && report.children.length > 1) {
    return report.children.map((child: ParentChildReport) => ({
      key: child.student_id,
      name: firstNameOf(child.student_first_name),
      focus: parentFocusLabel(child.focus_rating),
      work: child.work_summary,
      redirection: REDIRECTION_LABELS[child.redirection_level] ?? child.redirection_level,
      note: child.guide_note,
    }));
  }
  return [
    {
      key: report.id,
      name: report.children?.[0] ? firstNameOf(report.children[0].student_first_name) : "",
      focus: parentFocusLabel(report.focus_rating),
      work: report.work_summary,
      redirection: REDIRECTION_LABELS[report.redirection_level] ?? report.redirection_level,
      note: report.guide_note,
    },
  ];
}

function RecapField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-medium tracking-[0.12em] text-ink-400 uppercase">{label}</p>
      <p className="mt-0.5 whitespace-pre-wrap text-sm text-ink-800">{value}</p>
    </div>
  );
}

export function ParentSessionRecap({
  report,
  recording,
  escalated = false,
}: {
  report: ParentReport | null;
  recording: {
    id: string;
    status: string;
    retention_until: string | null;
    deleted_at: string | null;
    playable: boolean;
  } | null;
  escalated?: boolean;
}) {
  const sections = recapChildren(report);
  const rec = recording;

  return (
    <div className="space-y-6">
      <section>
        {escalated ? (
          <p className="mb-3 text-sm text-ink-600">A parent attention request was sent during this session.</p>
        ) : null}
        {report ? (
          <div className="space-y-6">
            {sections.map((child) => (
              <div
                key={child.key}
                className="space-y-3 border-b border-ink-100 pb-5 last:border-0 last:pb-0"
              >
                {child.name && sections.length > 1 ? (
                  <p className="font-medium text-ink-900">{child.name}</p>
                ) : null}
                <RecapField label="Focus" value={child.focus} />
                <RecapField label="Worked on" value={child.work} />
                <RecapField label="Redirection" value={child.redirection} />
                {child.note ? <RecapField label="Guide note" value={child.note} /> : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-ink-500">No report yet.</p>
        )}
      </section>

      <section>
        <p className="text-[11px] font-semibold tracking-[0.14em] text-ink-400 uppercase">Recording</p>
        {!rec ? (
          <p className="mt-2 text-sm text-ink-500">No recording yet.</p>
        ) : rec.status === "failed" ? (
          <p className="mt-2 text-sm text-ink-600">Recording unavailable</p>
        ) : rec.deleted_at || (!rec.playable && rec.status === "completed") ? (
          <p className="mt-2 text-sm text-ink-600">Recording expired</p>
        ) : rec.status !== "completed" ? (
          <p className="mt-2 text-sm text-ink-600">Recording processing</p>
        ) : (
          <div className="mt-2">
            <p className="text-sm text-ink-700">{recordingAvailabilityLabel(rec.retention_until)}</p>
            <p className="text-xs text-ink-400">Available for 60 days after the Study Hall.</p>
            <WatchRecordingButton recordingId={rec.id} />
          </div>
        )}
      </section>
    </div>
  );
}

export function ParentCompletedHeader({
  when,
  childrenLine,
  guide,
}: {
  when: string;
  childrenLine: string;
  guide: string | null;
}) {
  return (
    <ParentSurface featured>
      <p className="text-[11px] font-semibold tracking-[0.16em] text-gold-300 uppercase">Study Hall complete</p>
      <p className="mt-2 font-display text-[1.65rem] font-semibold tracking-[-0.03em] text-white sm:text-[1.85rem]">
        {when}
      </p>
      <p className="mt-3 text-lg font-medium text-white">{childrenLine}</p>
      {guide ? (
        <p className="mt-1 text-sm text-white/60">
          Guide <span className="font-medium text-white/86">{guide}</span>
        </p>
      ) : null}
    </ParentSurface>
  );
}
