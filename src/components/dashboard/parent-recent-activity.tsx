import Link from "next/link";

import { WatchRecordingButton } from "@/components/dashboard/watch-recording-button";
import { childFirstName, parentGuideLabel } from "@/lib/parent-portal.mjs";
import { recordingAvailabilityLabel } from "@/lib/recording-retention.mjs";
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
  if (!booking) {
    return (
      <section>
        <h2 className="text-sm font-semibold tracking-wide text-ink-400 uppercase">Last Study Hall</h2>
        <p className="mt-2 text-sm text-ink-500">Your completed Study Halls will appear here.</p>
      </section>
    );
  }

  const tz = booking.students?.timezone || DEFAULT_TZ;
  const when = booking.scheduled_start ? formatDayHeading(booking.scheduled_start, tz) : "Recently";
  const child = childFirstName(booking.students?.full_name);
  const guide = parentGuideLabel(booking);
  const playable = recording?.status === "completed" && !recording.deleted_at;
  const recLabel = !recording
    ? null
    : recording.status === "failed"
      ? "Recording unavailable"
      : recording.deleted_at
        ? "Recording expired"
        : recording.status !== "completed"
          ? "Recording processing"
          : recordingAvailabilityLabel(recording.retention_until);

  return (
    <section>
      <h2 className="text-sm font-semibold tracking-wide text-ink-400 uppercase">Last Study Hall</h2>
      <p className="mt-2 text-sm text-ink-800">
        {when}
        {guide ? ` · ${guide}` : ""}
        {child ? ` · ${child}` : ""}
      </p>
      <p className="mt-2 text-sm text-ink-600">
        {report ? "Report ready" : "No report yet"}
        {recLabel ? ` · ${recLabel}` : ""}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        {report ? (
          <Link href={`/dashboard/student/reports#hall-${booking.id}`} className="text-sm font-semibold text-gold-700 hover:underline">
            View report
          </Link>
        ) : (
          <Link href={`/dashboard/student/study-halls/${booking.id}`} className="text-sm font-medium text-ink-600 hover:underline">
            View
          </Link>
        )}
        {playable && recording ? <WatchRecordingButton recordingId={recording.id} /> : null}
      </div>
    </section>
  );
}
