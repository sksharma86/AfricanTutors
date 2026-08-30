import { ParentSurface } from "@/components/dashboard/parent-surface";
import { completedStudyHallsThisMonth, parentHabitCopy } from "@/lib/parent-portal.mjs";
import type { ParentBooking } from "@/lib/parent-portal-types";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

function firstWeekdaySunday(yearMonth: string, timeZone: string) {
  const start = new Date(`${yearMonth}-01T12:00:00.000Z`);
  const label = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(start);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(label);
}

/**
 * Compact consistency evidence for the current calendar month.
 * Not a quota, allowance, or progress-toward-a-limit visualization.
 */
export function ParentHabitCard({
  bookings,
  nowMs,
  timeZone = "America/Chicago",
}: {
  bookings: ParentBooking[];
  nowMs?: number;
  timeZone?: string;
}) {
  const month = completedStudyHallsThisMonth(bookings, nowMs, timeZone);
  const copy = parentHabitCopy(month.count);
  const active = new Set(month.days);
  const offset = Math.max(0, firstWeekdaySunday(month.yearMonth, timeZone));
  const cells = [...Array(offset).fill(null), ...Array.from({ length: month.daysInMonth }, (_, i) => i + 1)];

  return (
    <ParentSurface className="pp-habit px-4 py-3.5">
      <p className="text-[10px] font-semibold tracking-[0.14em] text-[var(--pp-muted)] uppercase">
        Study Halls this month
      </p>
      <p className="mt-2 font-display text-[2.15rem] font-semibold leading-none tracking-[-0.045em] text-[var(--pp-ink)]">
        {month.count}
      </p>
      <p className="mt-1 text-[13px] text-[var(--pp-muted)]">
        Study Hall{month.count === 1 ? "" : "s"} completed
      </p>
      <p className="mt-2.5 text-[14px] font-medium tracking-[-0.02em] text-[var(--pp-ink)]">{copy.title}</p>
      <ol className="mt-3 grid grid-cols-7 gap-y-1.5" aria-label="Days with a completed Study Hall this month">
        {WEEKDAYS.map((day, i) => (
          <li key={`wd-${i}`} className="text-center text-[9px] font-medium text-[#9a9286]">
            {day}
          </li>
        ))}
        {cells.map((day, i) => (
          <li key={`d-${i}`} className="flex justify-center">
            {day == null ? (
              <span className="size-1.5" />
            ) : (
              <span
                title={active.has(day) ? `Study Hall on day ${day}` : undefined}
                className={
                  active.has(day)
                    ? "size-1.5 rounded-full bg-[#c9a227]"
                    : "size-1.5 rounded-full bg-[#1c1915]/12"
                }
              />
            )}
          </li>
        ))}
      </ol>
    </ParentSurface>
  );
}
