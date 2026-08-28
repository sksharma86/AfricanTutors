import { ParentSurface } from "@/components/dashboard/parent-surface";
import { WatchRecordingButton } from "@/components/dashboard/watch-recording-button";
import { LinkButton } from "@/components/ui/button";
import { bookingChildNames } from "@/lib/household-children.mjs";
import { parentRecordingHomeLabel } from "@/lib/parent-next-step.mjs";
import { childFirstName, parentGuideLabel } from "@/lib/parent-portal.mjs";
import { formatDayHeading } from "@/lib/timezone";
import type { ParentBooking, ParentRecording, ParentReport } from "@/lib/parent-portal-types";

const DEFAULT_TZ = "America/Chicago";

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
  const when = booking.scheduled_start ? formatDayHeading(booking.scheduled_start, tz) : "Recently";
  const child = bookingChildNames(booking, childFirstName(booking.students?.full_name));
  const guide = parentGuideLabel(booking);
  const playable = recording?.status === "completed" && !recording.deleted_at;
  const recLabel = parentRecordingHomeLabel(recording);

  return (
    <ParentSurface>
      <p className="text-[11px] font-semibold tracking-[0.14em] text-ink-400 uppercase">Last Study Hall</p>
      <p className="mt-2 text-sm font-medium text-ink-900">
        {when}
        {child ? ` · ${child}` : ""}
      </p>
      {guide ? <p className="mt-0.5 text-sm text-ink-500">Guide {guide}</p> : null}
      <p className="mt-2 text-sm text-ink-600">
        {report ? "Report ready" : "No report yet"}
        {recLabel ? ` · ${recLabel}` : ""}
      </p>
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
