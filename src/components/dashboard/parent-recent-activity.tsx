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
    <p className={`flex items-center gap-2 text-[13px] ${color}`}>
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
    <ParentSurface className="px-4 py-3.5">
      <p className="text-[10px] font-semibold tracking-[0.14em] text-[var(--pp-muted)] uppercase">Recent Study Hall</p>
      <p className="mt-2 text-[13px] text-[var(--pp-muted)]">{when}</p>
      <p className="mt-1 text-[14px] font-medium text-[var(--pp-ink)]">{child}</p>
      {guide ? <p className="mt-0.5 text-[13px] text-[var(--pp-muted)]">with Guide {guide}</p> : null}
      <div className="mt-2.5 space-y-1.5">
        <StatusRow
          icon={<ParentIconReports className="h-3.5 w-3.5" />}
          label={report ? "Report ready" : "No report yet"}
          tone={report ? "ok" : "muted"}
        />
        {recLabel ? (
          <StatusRow
            icon={<ParentIconPlay className="h-3.5 w-3.5" />}
            label={recLabel}
            tone={recLabel === "Recording ready" ? "ok" : recLabel.includes("unavailable") || recLabel.includes("expired") ? "attention" : "muted"}
          />
        ) : null}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
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
