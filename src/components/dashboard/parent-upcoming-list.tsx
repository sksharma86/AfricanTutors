import { ParentIconChevron } from "@/components/dashboard/parent-icons";
import { ParentSurface } from "@/components/dashboard/parent-surface";
import { bookingChildNames } from "@/lib/household-children.mjs";
import { childFirstName, parentGuideLabel, parentStatusLabel } from "@/lib/parent-portal.mjs";
import { formatDayHeading, formatTime } from "@/lib/timezone";
import type { ParentBooking } from "@/lib/parent-portal-types";
import Link from "next/link";

const DEFAULT_TZ = "America/Chicago";

export function ParentUpcomingList({ bookings }: { bookings: ParentBooking[] }) {
  if (bookings.length === 0) return null;

  return (
    <ParentSurface>
      <p className="text-[11px] font-semibold tracking-[0.14em] text-[var(--pp-muted)] uppercase">Upcoming</p>
      <ul className="mt-2 divide-y divide-[#1c1915]/[0.06]">
        {bookings.map((booking) => {
          const tz = booking.students?.timezone || DEFAULT_TZ;
          const day = booking.scheduled_start ? formatDayHeading(booking.scheduled_start, tz) : "Time to confirm";
          const time = booking.scheduled_start
            ? `${formatTime(booking.scheduled_start, tz)}${
                booking.scheduled_end ? ` – ${formatTime(booking.scheduled_end, tz)}` : ""
              }`
            : "";
          const child = bookingChildNames(booking, childFirstName(booking.students?.full_name));
          const guide = parentGuideLabel(booking);
          return (
            <li key={booking.id}>
              <Link
                href={`/dashboard/student/study-halls/${booking.id}`}
                className="pp-interact flex items-center gap-3 py-3.5 first:pt-2 last:pb-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-[var(--pp-ink)]">{day}</p>
                  {time ? <p className="mt-0.5 text-sm text-[var(--pp-muted)]">{time}</p> : null}
                  <p className="mt-1 text-sm text-[var(--pp-ink)]">{child}</p>
                  <p className="text-sm text-[var(--pp-muted)]">
                    {guide ? `Guide ${guide}` : ""}
                    {guide ? " · " : ""}
                    <span data-kind="status">{parentStatusLabel(booking)}</span>
                  </p>
                </div>
                <ParentIconChevron className="text-[#9a9286]" />
              </Link>
            </li>
          );
        })}
      </ul>
    </ParentSurface>
  );
}
