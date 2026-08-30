import type { ReactNode } from "react";

import { ParentIconPlay, ParentIconReports } from "@/components/dashboard/parent-icons";
import { ParentSurface } from "@/components/dashboard/parent-surface";
import { WatchRecordingButton } from "@/components/dashboard/watch-recording-button";
import { LinkButton } from "@/components/ui/button";
import { bookingChildNames } from "@/lib/household-children.mjs";
import { parentRecordingHomeLabel } from "@/lib/parent-next-step.mjs";
import { childFirstName, parentGuideLabel } from "@/lib/parent-portal.mjs";
import { formatDayHeading, formatTime } from "@/lib/timezone";
import type { ParentBooking, ParentRecording, ParentReport } from "@/lib/parent-portal-types";

const DEFAULT_TZ = "America/Chicago";

function StatusRow({
  icon,
  label,
  tone = "muted",
}: {
  icon: ReactNode;
  label: string;
  tone?: "ok" | "muted" | "attention";
}) {
  const color =
    tone === "ok" ? "text-[var(--pp-positive)]" : tone === "attention" ? "text-[var(--pp-attention)]" : "text-[var(--pp-muted)]";
  return (
    <p className={`flex items-center gap-2.5 text-sm ${color}`}>
      <span className="text-current">{icon}</span>
      {label}
    </p>
  );
}

export function ParentRecentActivity({
  booking,
  report,
  recording,
}: {
  booking: ParentBooking | null;
  report: ParentReport | null;
  recording: ParentRecording | null;
}) {
  if (!booking) return null;

  const tz = booking.students?.timezone || DEFAULT_TZ;
  const when = booking.scheduled_start
    ? `${formatDayHeading(booking.scheduled_start, tz)}${
        booking.scheduled_start ? ` · ${formatTime(booking.scheduled_start, tz)}` : ""
      }`
    : "Recently";
  const child = bookingChildNames(booking, childFirstName(booking.students?.full_name));
  const guide = parentGuideLabel(booking);
  const playable = recording?.status === "completed" && !recording.deleted_at;
  const recLabel = parentRecordingHomeLabel(recording);

  return (
    <ParentSurface>
      <p className="text-[11px] font-semibold tracking-[0.14em] text-[var(--pp-muted)] uppercase">Recent Study Hall</p>
      <p className="mt-2.5 text-[15px] font-medium text-[var(--pp-ink)]">
        {when}
        {child ? ` · ${child}` : ""}
      </p>
      {guide ? <p className="mt-0.5 text-sm text-[var(--pp-muted)]">Guide {guide}</p> : null}
      <div className="mt-3.5 space-y-2">
        <StatusRow
          icon={<ParentIconReports className="h-4 w-4" />}
          label={report ? "Report ready" : "No report yet"}
          tone={report ? "ok" : "muted"}
        />
        {recLabel ? (
          <StatusRow
            icon={<ParentIconPlay className="h-4 w-4" />}
            label={recLabel}
            tone={recLabel === "Recording ready" ? "ok" : recLabel.includes("unavailable") || recLabel.includes("expired") ? "attention" : "muted"}
          />
        ) : null}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {report ? (
          <LinkButton href={`/dashboard/student/study-halls/${booking.id}`} variant="outline" size="sm">
            Read report
          </LinkButton>
        ) : (
          <LinkButton href={`/dashboard/student/study-halls/${booking.id}`} variant="outline" size="sm">
            View Study Hall
          </LinkButton>
        )}
        {playable && recording ? <WatchRecordingButton recordingId={recording.id} /> : null}
      </div>
    </ParentSurface>
  );
}
