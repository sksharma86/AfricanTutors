import Link from "next/link";

import { GuideSurface } from "@/components/dashboard/guide-surface";
import { formatDuration } from "@/lib/format.mjs";
import { guideChildName, guideRowStatus } from "@/lib/guide-portal.mjs";
import { formatTime } from "@/lib/timezone";
import type { GuideBooking } from "@/lib/guide-portal-types";

const HOME_LIMIT = 5;

export function GuideTodaySchedule({
  rows,
  nextId,
  tz,
  nowMs,
}: {
  rows: GuideBooking[];
  nextId?: string | null;
  tz: string;
  nowMs?: number;
}) {
  const visible = rows.slice(0, HOME_LIMIT);

  return (
    <GuideSurface className="px-4 py-3.5">
      <p className="text-[10px] font-semibold tracking-[0.14em] text-[var(--gp-muted)] uppercase">{"Today's schedule"}</p>
      {visible.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--gp-muted)]">Nothing else today.</p>
      ) : (
        <ul className="mt-1 divide-y divide-[#1c1915]/[0.06]">
          {visible.map((booking) => {
            const status = guideRowStatus(booking, nowMs);
            const done = status === "Completed" || status === "Ended" || status === "No-show";
            const next = booking.id === nextId;
            return (
              <li
                key={booking.id}
                className={next ? "flex items-baseline gap-3 py-2.5" : "flex items-baseline gap-3 py-2.5 opacity-95"}
              >
                <p
                  className={
                    done
                      ? "w-[4.75rem] shrink-0 text-[13px] tabular-nums text-[var(--gp-muted)]"
                      : "w-[4.75rem] shrink-0 text-[13px] font-medium tabular-nums text-[var(--gp-ink)]"
                  }
                >
                  {booking.scheduled_start ? formatTime(booking.scheduled_start, tz) : "—"}
                </p>
                <p className={done ? "min-w-0 flex-1 text-[13px] text-[var(--gp-muted)]" : "min-w-0 flex-1 text-[13px] font-medium text-[var(--gp-ink)]"}>
                  {guideChildName(booking)}
                  {booking.duration_minutes ? (
                    <span className="font-normal text-[var(--gp-muted)]"> · {formatDuration(booking.duration_minutes)}</span>
                  ) : null}
                </p>
                <span data-kind="status" className="shrink-0 text-[12px] text-[var(--gp-muted)]">
                  {status}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-2.5">
        <Link href="/dashboard/tutor/study-halls" className="text-[13px] font-medium text-[var(--gp-ink)] underline-offset-4 hover:underline">
          View full schedule →
        </Link>
      </p>
    </GuideSurface>
  );
}
