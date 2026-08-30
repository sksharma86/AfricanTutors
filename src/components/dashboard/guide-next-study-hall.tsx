import { GuideConfirmAttendance } from "@/components/dashboard/guide-confirm-attendance";
import { GuideJoinControl } from "@/components/dashboard/guide-join-control";
import { GuideSurface } from "@/components/dashboard/guide-surface";
import { LinkButton } from "@/components/ui/button";
import { guideAttendanceState } from "@/lib/guide-attendance.mjs";
import { guideChildName, guideChildrenCaption, guideStartsInLabel } from "@/lib/guide-portal.mjs";
import { formatStudyHallDuration } from "@/lib/studyhall-duration.mjs";
import { formatDayHeading, formatTime } from "@/lib/timezone";
import { guideJoinUiState } from "@/lib/tutor-schedule.mjs";
import type { GuideBooking } from "@/lib/guide-portal-types";

function HeroAtmosphere() {
  return (
    <div className="gp-hero-atmosphere" aria-hidden>
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 640 320" preserveAspectRatio="xMaxYMin slice">
        <defs>
          <radialGradient id="gp-lamp" cx="50%" cy="0%" r="70%">
            <stop offset="0%" stopColor="#ffe7a8" stopOpacity="0.55" />
            <stop offset="22%" stopColor="#f3d27a" stopOpacity="0.28" />
            <stop offset="58%" stopColor="#c9a227" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#c9a227" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="gp-desk" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#0a0d0b" stopOpacity="0" />
            <stop offset="100%" stopColor="#080a08" stopOpacity="0.72" />
          </linearGradient>
        </defs>
        <ellipse cx="528" cy="-6" rx="196" ry="128" fill="url(#gp-lamp)" />
        <path d="M508 0v38" stroke="#e8c56a" strokeOpacity="0.28" strokeWidth="1.4" />
        <path d="M488 42c12-16 28-16 40 0" stroke="#f3d27a" strokeOpacity="0.32" strokeWidth="1.3" fill="none" />
        <path d="M0 248c90-22 168-6 248 10 92 18 176-16 260 2 72 16 90 10 132-6v66H0z" fill="url(#gp-desk)" />
        <rect x="402" y="274" width="118" height="7" rx="2" fill="#c9a227" fillOpacity="0.16" />
      </svg>
    </div>
  );
}

export function GuideNextStudyHall({
  next,
  tz,
  nowMs,
}: {
  next: GuideBooking | null;
  tz: string;
  nowMs: number;
}) {
  if (!next) {
    return (
      <GuideSurface featured className="min-h-[15.5rem]">
        <HeroAtmosphere />
        <div className="relative flex h-full min-h-[13.5rem] flex-col justify-between">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.16em] text-gold-300 uppercase">Next Study Hall</p>
            <p className="mt-4 font-display text-[1.55rem] font-semibold tracking-[-0.03em] text-white sm:text-[1.85rem]">
              You&apos;re all clear for now.
            </p>
            <p className="mt-2 max-w-md text-sm leading-6 text-white/62">
              Keep your availability current so we can match you with upcoming Study Halls.
            </p>
          </div>
          <div className="mt-6">
            <LinkButton href="/dashboard/tutor/availability" variant="secondary" size="lg">
              Manage availability →
            </LinkButton>
          </div>
        </div>
      </GuideSurface>
    );
  }

  const join = guideJoinUiState(next.status, next.scheduled_start, next.scheduled_end, nowMs);
  const attendance = guideAttendanceState({
    status: next.status,
    scheduledStart: next.scheduled_start,
    assignment: next.attendance ?? null,
    nowMs,
  });
  const starts = guideStartsInLabel(next.scheduled_start, nowMs);
  const child = guideChildName(next);
  const time = next.scheduled_start ? formatTime(next.scheduled_start, tz) : "";
  const day = next.scheduled_start ? formatDayHeading(next.scheduled_start, tz) : "Time to confirm";
  const minutes = next.duration_minutes;

  return (
    <GuideSurface featured className="min-h-[15.5rem]">
      <HeroAtmosphere />
      <div className="relative flex h-full min-h-[13.5rem] flex-col justify-between">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.16em] text-gold-300 uppercase">Next Study Hall</p>
          {time ? (
            <p className="mt-3 font-display text-[2.55rem] font-semibold leading-[0.96] tracking-[-0.045em] text-white sm:text-[2.9rem]">
              {time}
            </p>
          ) : (
            <p className="mt-3 font-display text-[1.55rem] font-semibold tracking-[-0.03em] text-white">Time to confirm</p>
          )}
          <p className="mt-1.5 text-[14px] text-white/68">
            {day}
            {minutes ? ` · ${formatStudyHallDuration(minutes)}` : ""}
          </p>
          <div className="mt-4 border-t border-white/12 pt-3.5">
            <p className="text-[1.15rem] font-medium tracking-[-0.02em] text-white">{child}</p>
            {guideChildrenCaption(next) ? (
              <p className="mt-0.5 text-sm text-white/60">{guideChildrenCaption(next)}</p>
            ) : null}
            {starts && join.kind !== "join" ? (
              <p className="mt-2 text-sm font-medium text-gold-200">{starts}</p>
            ) : null}
            {join.kind === "opens_at" ? (
              <p className="mt-1 text-[13px] text-white/55">Be ready 5 minutes before start time.</p>
            ) : null}
            {attendance.kind === "awaiting" ? (
              <p className="mt-3 text-[11px] font-semibold tracking-[0.14em] text-gold-300 uppercase">
                Attendance confirmation required
              </p>
            ) : null}
            {attendance.kind === "confirmed" ? (
              <p className="mt-3 text-sm font-medium text-gold-200">✓ Attendance confirmed</p>
            ) : null}
            {attendance.kind === "missed" ? (
              <p className="mt-3 text-sm text-white/70">Confirmation missed</p>
            ) : null}
          </div>
        </div>
        <div className="mt-5 space-y-3">
          {attendance.kind === "awaiting" ? <GuideConfirmAttendance bookingId={next.id} prominent /> : null}
          {join.kind === "join" ? (
            <LinkButton href={`/dashboard/session/${next.id}`} variant="secondary" size="lg">
              Join Study Hall →
            </LinkButton>
          ) : attendance.kind === "awaiting" ? null : (
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
      </div>
    </GuideSurface>
  );
}
