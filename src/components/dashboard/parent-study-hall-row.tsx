import Link from "next/link";

import { bookingChildNames } from "@/lib/household-children.mjs";
import { parentGuideLabel, parentStatusLabel } from "@/lib/parent-portal.mjs";
import { formatDayHeading, formatTime } from "@/lib/timezone";
import type { ParentBooking } from "@/lib/parent-portal-types";

const DEFAULT_TZ = "America/Chicago";

export function ParentStudyHallRow({
  booking,
  past = false,
}: {
  booking: ParentBooking;
  past?: boolean;
}) {
  const tz = booking.students?.timezone || DEFAULT_TZ;
  const day = booking.scheduled_start ? formatDayHeading(booking.scheduled_start, tz) : "Time to confirm";
  const time = booking.scheduled_start
    ? `${formatTime(booking.scheduled_start, tz)}${booking.scheduled_end ? ` – ${formatTime(booking.scheduled_end, tz)}` : ""}`
    : "";
  const child = bookingChildNames(booking);
  const guide = parentGuideLabel(booking);

  return (
    <li className="py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          {past ? (
            <>
              <p className="text-sm font-medium text-ink-900">{child}</p>
              <p className="mt-0.5 text-sm text-ink-700">
                {day}
                {time ? ` · ${time}` : ""}
              </p>
              <p className="mt-1 text-sm text-ink-500">
                {guide ? `Guide ${guide}` : ""}
                {guide ? " · " : ""}
                {parentStatusLabel(booking)}
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-ink-900">{day}</p>
              {time ? <p className="text-sm text-ink-700">{time}</p> : null}
              <p className="mt-1 text-sm text-ink-800">{child}</p>
              <p className="text-sm text-ink-500">
                {guide ? `Guide ${guide}` : ""}
                {guide ? " · " : ""}
                {parentStatusLabel(booking)}
              </p>
            </>
          )}
        </div>
        <Link
          href={`/dashboard/student/study-halls/${booking.id}`}
          className="shrink-0 text-sm font-medium text-gold-700 hover:underline"
        >
          View
        </Link>
      </div>
    </li>
  );
}
