import { ParentIconCalendar } from "@/components/dashboard/parent-icons";
import { ParentSurface } from "@/components/dashboard/parent-surface";
import { LinkButton } from "@/components/ui/button";
import { formatDuration } from "@/lib/format.mjs";
import { bookingChildNames } from "@/lib/household-children.mjs";
import { childFirstName, parentGuideLabel, parentJoinHint, parentSessionMinutes } from "@/lib/parent-portal.mjs";
import { formatDayHeading, formatTime } from "@/lib/timezone";
import type { ParentBooking } from "@/lib/parent-portal-types";

const DEFAULT_TZ = "America/Chicago";

function HeroAtmosphere() {
  return (
    <div className="pp-hero-atmosphere" aria-hidden>
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 640 320" preserveAspectRatio="xMaxYMin slice">
        <defs>
          <radialGradient id="pp-lamp" cx="50%" cy="0%" r="70%">
            <stop offset="0%" stopColor="#ffe7a8" stopOpacity="0.55" />
            <stop offset="22%" stopColor="#f3d27a" stopOpacity="0.28" />
            <stop offset="58%" stopColor="#c9a227" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#c9a227" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="pp-desk" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#0a0d0b" stopOpacity="0" />
            <stop offset="100%" stopColor="#080a08" stopOpacity="0.72" />
          </linearGradient>
        </defs>
        <ellipse cx="528" cy="-6" rx="196" ry="128" fill="url(#pp-lamp)" />
        <path d="M508 0v38" stroke="#e8c56a" strokeOpacity="0.28" strokeWidth="1.4" />
        <path d="M488 42c12-16 28-16 40 0" stroke="#f3d27a" strokeOpacity="0.32" strokeWidth="1.3" fill="none" />
        <path d="M0 248c90-22 168-6 248 10 92 18 176-16 260 2 72 16 90 10 132-6v66H0z" fill="url(#pp-desk)" />
        <rect x="402" y="274" width="118" height="7" rx="2" fill="#c9a227" fillOpacity="0.16" />
        <rect x="428" y="262" width="36" height="14" rx="2" fill="#c9a227" fillOpacity="0.08" />
      </svg>
    </div>
  );
}

export function ParentNextStudyHall({
  next,
}: {
  next: ParentBooking | null;
}) {
  if (!next) {
    return (
      <ParentSurface featured className="min-h-[17rem]">
        <HeroAtmosphere />
        <div className="relative flex h-full min-h-[15rem] flex-col justify-between">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.16em] text-gold-300 uppercase">Next Study Hall</p>
            <div className="mt-4 flex items-start gap-3">
              <span className="mt-0.5 inline-flex size-8 items-center justify-center rounded-full bg-white/8 text-gold-300">
                <ParentIconCalendar />
              </span>
              <div>
                <p className="font-display text-[1.55rem] font-semibold tracking-[-0.03em] text-white sm:text-[1.85rem]">
                  Nothing scheduled yet
                </p>
                <p className="mt-1 text-sm leading-6 text-white/62">
                  Book your first Study Hall when you&apos;re ready.
                </p>
              </div>
            </div>
          </div>
          <div className="mt-6">
            <LinkButton href="/dashboard/student/book" variant="secondary" size="lg">
              Book a Study Hall
            </LinkButton>
          </div>
        </div>
      </ParentSurface>
    );
  }

  const tz = next.students?.timezone || DEFAULT_TZ;
  const join = parentJoinHint(next);
  const child = bookingChildNames(next, childFirstName(next.students?.full_name, "Your child"));
  const guide = parentGuideLabel(next);
  const minutes = parentSessionMinutes(next);
  const day = next.scheduled_start ? formatDayHeading(next.scheduled_start, tz) : "Time to confirm";
  const time = next.scheduled_start ? formatTime(next.scheduled_start, tz) : "";

  return (
    <ParentSurface featured className="min-h-[17rem]">
      <HeroAtmosphere />
      <div className="relative flex h-full min-h-[15rem] flex-col justify-between">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.16em] text-gold-300 uppercase">Next Study Hall</p>
          {time ? (
            <p className="mt-3 font-display text-[2.55rem] font-semibold leading-[0.96] tracking-[-0.045em] text-white sm:text-[2.9rem]">
              {time}
            </p>
          ) : (
            <p className="mt-3 font-display text-[1.55rem] font-semibold tracking-[-0.03em] text-white sm:text-[1.75rem]">
              Time to confirm
            </p>
          )}
          <p className="mt-1.5 text-[14px] text-white/68">
            {day}
            {minutes ? ` · ${formatDuration(minutes)}` : ""}
          </p>
          <div className="mt-4 border-t border-white/12 pt-3.5">
            <p className="text-[1.15rem] font-medium tracking-[-0.02em] text-white">{child}</p>
            {guide ? (
              <p className="mt-0.5 text-sm text-white/60">
                with Guide <span className="font-medium text-white/86">{guide}</span>
              </p>
            ) : null}
          </div>
        </div>
        <div className="mt-5">
          {join.state !== "join" && join.label ? (
            <p className="mb-3 text-sm font-medium text-gold-200">{join.label}</p>
          ) : null}
          {join.state === "join" ? (
            <LinkButton href={`/dashboard/session/${next.id}`} variant="secondary" size="lg">
              Join Study Hall →
            </LinkButton>
          ) : (
            <LinkButton
              href={`/dashboard/student/study-halls/${next.id}`}
              variant="ghost"
              size="sm"
              className="px-0 text-white/70 hover:bg-transparent hover:text-white"
            >
              View Study Hall
            </LinkButton>
          )}
        </div>
      </div>
    </ParentSurface>
  );
}
