import Link from "next/link";

import { ParentSurface } from "@/components/dashboard/parent-surface";
import { LinkButton } from "@/components/ui/button";
import { PLAN_MY_WEEK_HREF } from "@/lib/plan-my-week.mjs";
import {
  PARENT_BOOK_HREF,
  parentWeekCompletion,
  parentWeekCompletionCopy,
  parentWeekStrip,
  type ParentHomeCtas,
} from "@/lib/parent-week.mjs";
import type { ParentBooking } from "@/lib/parent-portal-types";

export function ParentStudyHallWeek({
  bookings,
  timeZone,
  nowMs,
  ctas,
}: {
  bookings: ParentBooking[];
  timeZone: string;
  nowMs?: number;
  ctas: ParentHomeCtas;
}) {
  const stamp = nowMs ?? Date.now();
  const days = parentWeekStrip(bookings, timeZone, stamp);
  const completion = parentWeekCompletion(bookings, timeZone, stamp);
  const copy = parentWeekCompletionCopy(completion);

  return (
    <ParentSurface className="px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.16em] text-[var(--pp-muted)] uppercase">
            Your Study Hall Week
          </p>
          <p className="mt-1 text-sm text-[var(--pp-muted)]">{completion.weekLabel}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <LinkButton href={ctas.primary.href} variant="primary" size="sm">
            {ctas.primary.label}
          </LinkButton>
          <LinkButton href={ctas.secondary.href} variant="outline" size="sm">
            {ctas.secondary.label}
          </LinkButton>
        </div>
      </div>

      <div className="pp-week-strip mt-4" role="list" aria-label="This week's Study Halls">
        {days.map((day) => (
          <div
            key={day.localDate}
            role="listitem"
            className={`pp-week-day is-${day.kind}${day.isToday ? " is-today" : ""}`}
            data-kind={day.kind}
          >
            <p className="pp-week-day-name">{day.weekdayShort}</p>
            <p className="pp-week-day-date">{day.monthDay}</p>
            <p className="pp-week-day-state">
              <span className="hidden sm:inline">{day.label}</span>
              <span className="sm:hidden">{day.compactLabel}</span>
            </p>
          </div>
        ))}
      </div>

      <p className="mt-4 text-sm font-medium text-[var(--pp-ink)]">{copy.headline}</p>
      <p className="mt-1 text-[13px] leading-5 text-[var(--pp-muted)]">{copy.body}</p>
      {completion.empty ? (
        <p className="mt-3 text-[13px]">
          <Link href={PLAN_MY_WEEK_HREF} className="font-medium text-[var(--pp-ink)] underline-offset-4 hover:underline">
            Plan my week
          </Link>
          <span className="text-[var(--pp-muted)]"> or </span>
          <Link href={PARENT_BOOK_HREF} className="font-medium text-[var(--pp-ink)] underline-offset-4 hover:underline">
            book one Study Hall
          </Link>
          .
        </p>
      ) : (
        <p className="mt-3">
          <Link href="/dashboard/student/study-halls" className="text-[13px] font-medium text-[var(--pp-ink)] underline-offset-4 hover:underline">
            View all Study Halls →
          </Link>
        </p>
      )}
    </ParentSurface>
  );
}
