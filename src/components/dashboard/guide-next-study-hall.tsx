import Link from "next/link";

import { GuideJoinControl } from "@/components/dashboard/guide-join-control";
import { GuideSurface } from "@/components/dashboard/guide-surface";
import { LinkButton } from "@/components/ui/button";
import { guideChildName, guideStartsInLabel } from "@/lib/guide-portal.mjs";
import { formatStudyHallDuration } from "@/lib/studyhall-duration.mjs";
import { formatDayHeading, formatTime } from "@/lib/timezone";
import { guideJoinUiState } from "@/lib/tutor-schedule.mjs";
import type { GuideBooking } from "@/lib/guide-portal-types";

export function GuideNextStudyHall({
  next,
  tz,
}: {
  next: GuideBooking | null;
  tz: string;
}) {
  if (!next) {
    return (
      <GuideSurface featured>
        <p className="text-[11px] font-semibold tracking-[0.16em] text-gold-700 uppercase">Your next Study Hall</p>
        <p className="mt-3 font-display text-3xl font-semibold tracking-[-0.03em] text-ink-900">
          No Study Hall scheduled.
        </p>
        <p className="mt-3 text-sm text-ink-500">Keep your availability up to date so you can be matched.</p>
      </GuideSurface>
    );
  }

  const when = next.scheduled_start
    ? `${formatDayHeading(next.scheduled_start, tz) === formatDayHeading(new Date().toISOString(), tz) ? "Today" : formatDayHeading(next.scheduled_start, tz)} · ${formatTime(next.scheduled_start, tz)}${
        next.scheduled_end ? ` – ${formatTime(next.scheduled_end, tz)}` : ""
      }`
    : "Time to confirm";
  const join = guideJoinUiState(next.status, next.scheduled_start, next.scheduled_end);
  const starts = guideStartsInLabel(next.scheduled_start);
  const child = guideChildName(next);

  return (
    <GuideSurface featured>
      <p className="text-[11px] font-semibold tracking-[0.16em] text-gold-700 uppercase">Your next Study Hall</p>
      <p className="mt-3 font-display text-3xl font-semibold tracking-[-0.03em] text-ink-900 sm:text-[2.15rem]">
        {when}
      </p>
      <p className="mt-4 text-xl font-medium text-ink-900">{child}</p>
      {next.duration_minutes ? (
        <p className="mt-1 text-sm text-ink-500">{formatStudyHallDuration(next.duration_minutes)}</p>
      ) : null}
      {starts && join.kind !== "join" ? <p className="mt-3 text-sm font-medium text-ink-600">{starts}</p> : null}

      <div className="mt-6">
        {join.kind === "join" ? (
          <LinkButton href={`/dashboard/session/${next.id}`} variant="secondary" size="lg" className="w-full sm:w-auto">
            Join Study Hall
          </LinkButton>
        ) : (
          <GuideJoinControl
            bookingId={next.id}
            status={next.status}
            scheduledStart={next.scheduled_start}
            scheduledEnd={next.scheduled_end}
            timezone={tz}
            prominent
          />
        )}
      </div>
      <p className="mt-5">
        <Link href={`/dashboard/tutor/study-halls`} className="text-sm font-medium text-ink-500 hover:text-ink-800">
          View Study Halls
        </Link>
      </p>
    </GuideSurface>
  );
}
