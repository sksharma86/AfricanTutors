import { ParentSurface } from "@/components/dashboard/parent-surface";
import { completedStudyHallsThisMonth, parentHabitCopy } from "@/lib/parent-portal.mjs";
import type { ParentBooking } from "@/lib/parent-portal-types";

/**
 * Consistency evidence for the current calendar month.
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

  return (
    <ParentSurface className="pp-habit">
      <p className="text-[11px] font-semibold tracking-[0.14em] text-[var(--pp-muted)] uppercase">
        Study Halls this month
      </p>
      <p className="mt-3 font-display text-[2.75rem] font-semibold leading-none tracking-[-0.045em] text-[var(--pp-ink)]">
        {month.count}
      </p>
      <p className="mt-2 text-sm text-[var(--pp-muted)]">
        Study Hall{month.count === 1 ? "" : "s"} completed
      </p>
      <p className="mt-4 text-[15px] font-medium tracking-[-0.02em] text-[var(--pp-ink)]">{copy.title}</p>
      <p className="mt-1.5 text-sm leading-6 text-[var(--pp-muted)]">{copy.body}</p>
      <ol className="mt-5 flex flex-wrap gap-1" aria-label="Days with a completed Study Hall this month">
        {Array.from({ length: month.daysInMonth }, (_, index) => {
          const day = index + 1;
          const done = active.has(day);
          return (
            <li
              key={day}
              title={done ? `Study Hall on day ${day}` : undefined}
              className={
                done
                  ? "h-1.5 w-1.5 rounded-full bg-[#c9a227]"
                  : "h-1.5 w-1.5 rounded-full bg-[#1c1915]/10"
              }
            />
          );
        })}
      </ol>
    </ParentSurface>
  );
}
