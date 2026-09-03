import Link from "next/link";

import { ParentIconChevron } from "@/components/dashboard/parent-icons";
import { ParentSurface } from "@/components/dashboard/parent-surface";
import { formatDuration } from "@/lib/format.mjs";
import { bookingChildNames } from "@/lib/household-children.mjs";
import {
  childFirstName,
  parentGuideLabel,
  parentSessionMinutes,
  parentStatusLabel,
  parentUpcomingEmptyCopy,
} from "@/lib/parent-portal.mjs";
import { formatTime } from "@/lib/timezone";
import type { ParentBooking } from "@/lib/parent-portal-types";

const DEFAULT_TZ = "America/Chicago";
const HOME_LIMIT = 2;

function weekday(iso: string, tz: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(new Date(iso)).toUpperCase();
}

function monthDay(iso: string, tz: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, month: "short", day: "numeric" }).format(new Date(iso));
}

export function ParentUpcomingList({
  bookings,
  showEmpty = false,
  hasNext = false,
}: {
  bookings: ParentBooking[];
  showEmpty?: boolean;
  hasNext?: boolean;
}) {
  if (bookings.length === 0 && !showEmpty) return null;
  const visible = bookings.slice(0, HOME_LIMIT);
  const extra = bookings.length - visible.length;

  return (
    <ParentSurface className="px-4 py-3.5">
      <p className="text-[10px] font-semibold tracking-[0.14em] text-[var(--pp-muted)] uppercase">Upcoming Study Halls</p>
      {visible.length === 0 ? (
        <div className="mt-3">
          <p className="text-sm text-[var(--pp-muted)]">{parentUpcomingEmptyCopy(hasNext)}</p>
          {hasNext ? null : (
            <p className="mt-1.5">
              <Link href="/dashboard/student/book" className="text-[13px] font-medium text-[var(--pp-ink)] underline-offset-4 hover:underline">
                Book one →
              </Link>
            </p>
          )}
        </div>
      ) : (
        <ul className="mt-1 divide-y divide-[#1c1915]/[0.06]">
          {visible.map((booking) => {
            const tz = booking.students?.timezone || DEFAULT_TZ;
            const start = booking.scheduled_start;
            const minutes = parentSessionMinutes(booking);
            const child = bookingChildNames(booking, childFirstName(booking.students?.full_name));
            const guide = parentGuideLabel(booking);
            const time = start
              ? `${formatTime(start, tz)}${booking.scheduled_end ? ` – ${formatTime(booking.scheduled_end, tz)}` : ""}`
              : "";
            return (
              <li key={booking.id}>
                <Link
                  href={`/dashboard/student/study-halls/${booking.id}`}
                  className="pp-interact flex items-center gap-3 py-2.5"
                >
                  <div className="w-14 shrink-0">
                    {start ? (
                      <>
                        <p className="text-[10px] font-semibold tracking-[0.08em] text-[#c9a227]">{weekday(start, tz)}</p>
                        <p className="text-[13px] font-semibold text-[var(--pp-ink)]">{monthDay(start, tz)}</p>
                      </>
                    ) : (
                      <p className="text-[13px] font-semibold text-[var(--pp-ink)]">TBD</p>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-[var(--pp-ink)]">
                      {time}
                      {time && minutes ? <span className="font-normal text-[var(--pp-muted)]"> · {formatDuration(minutes)}</span> : null}
                    </p>
                    <p className="truncate text-[13px] text-[var(--pp-ink)]">{child}</p>
                    <p className="truncate text-[12px] text-[var(--pp-muted)]">
                      {guide ? `with Guide ${guide}` : ""}
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
      )}
      {extra > 0 ? (
        <p className="mt-2">
          <Link href="/dashboard/student/study-halls" className="text-[13px] font-medium text-[var(--pp-ink)] underline-offset-4 hover:underline">
            View full schedule →
          </Link>
        </p>
      ) : null}
    </ParentSurface>
  );
}
