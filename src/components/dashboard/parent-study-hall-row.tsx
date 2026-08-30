import { ParentIconChevron } from "@/components/dashboard/parent-icons";
import { LinkButton } from "@/components/ui/button";
import { bookingChildNames } from "@/lib/household-children.mjs";
import { childFirstName, parentGuideLabel, parentStatusLabel } from "@/lib/parent-portal.mjs";
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
  const child = bookingChildNames(booking, childFirstName(booking.students?.full_name));
  const guide = parentGuideLabel(booking);

  return (
    <li className="py-4">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          {past ? (
            <>
              <p className="text-sm font-medium text-[var(--pp-ink)]">{child}</p>
              <p className="mt-0.5 text-sm text-[var(--pp-muted)]">
                {day}
                {time ? ` · ${time}` : ""}
              </p>
              <p className="mt-1 text-sm text-[var(--pp-muted)]">
                {guide ? `Guide ${guide}` : ""}
                {guide ? " · " : ""}
                <span data-kind="status">{parentStatusLabel(booking)}</span>
              </p>
            </>
          ) : (
            <>
              <p className="text-[13px] font-semibold text-[var(--pp-ink)]">{day}</p>
              {time ? <p className="text-sm text-[var(--pp-muted)]">{time}</p> : null}
              <p className="mt-1 text-sm text-[var(--pp-ink)]">{child}</p>
              <p className="text-sm text-[var(--pp-muted)]">
                {guide ? `Guide ${guide}` : ""}
                {guide ? " · " : ""}
                <span data-kind="status">{parentStatusLabel(booking)}</span>
              </p>
            </>
          )}
        </div>
        <LinkButton
          href={`/dashboard/student/study-halls/${booking.id}`}
          variant="outline"
          size="sm"
          className="shrink-0 border-[#e6dcc8] bg-[var(--pp-card)]"
        >
          View
          <ParentIconChevron className="h-3.5 w-3.5" />
        </LinkButton>
      </div>
    </li>
  );
}
