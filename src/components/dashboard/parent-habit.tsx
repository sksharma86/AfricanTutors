import { ParentSurface } from "@/components/dashboard/parent-surface";
import { completedStudyHallsThisMonth, parentHabitCopy } from "@/lib/parent-portal.mjs";
import type { ParentBooking } from "@/lib/parent-portal-types";

const STAGES = ["Getting started", "Building momentum", "Strong routine", "Habit forming"] as const;

/** Maps completed-this-month count onto four behavioral stages. Not a quota. */
export function parentHabitStage(count: number) {
  const n = Math.max(0, Number(count) || 0);
  if (n <= 0) return 0;
  if (n <= 2) return 1;
  if (n <= 5) return 2;
  if (n <= 9) return 3;
  return 4;
}

function HabitTrack({ stage, label }: { stage: number; label: string }) {
  return (
    <ol className="pp-habit-track" aria-label={`Homework routine: ${label}`}>
      {STAGES.map((name, index) => {
        const reached = stage > index;
        const current = stage === 0 ? index === 0 : stage === index + 1;
        return (
          <li key={name} className="pp-habit-step">
            {index > 0 ? <span className={reached || current ? "pp-habit-seg is-lit" : "pp-habit-seg"} /> : null}
            <span
              className={
                current && stage === 0
                  ? "pp-habit-node is-ready"
                  : current
                    ? "pp-habit-node is-current"
                    : reached
                      ? "pp-habit-node is-reached"
                      : "pp-habit-node"
              }
            >
              <span className="sr-only">{name}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
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
  const stage = parentHabitStage(month.count);

  return (
    <ParentSurface className="pp-habit px-4 py-3.5">
      <p className="text-[10px] font-semibold tracking-[0.14em] text-[var(--pp-muted)] uppercase">
        This month
      </p>
      <div className="pp-habit-top">
        <div>
          <p className="mt-2 font-display text-[2.15rem] font-semibold leading-none tracking-[-0.045em] text-[var(--pp-ink)]">
            {month.count}
          </p>
          <p className="mt-1 text-[13px] text-[var(--pp-muted)]">
            Study Hall{month.count === 1 ? "" : "s"} completed
          </p>
        </div>
        <HabitTrack stage={stage} label={copy.title} />
      </div>
      <p className="mt-3 text-[14px] font-medium tracking-[-0.02em] text-[var(--pp-ink)]">{copy.title}</p>
      <p className="mt-1 text-[12.5px] leading-5 text-[var(--pp-muted)]">{copy.body}</p>
    </ParentSurface>
  );
}
