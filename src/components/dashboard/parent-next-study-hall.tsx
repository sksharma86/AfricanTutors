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
          <radialGradient id="pp-lamp" cx="78%" cy="8%" r="42%">
            <stop offset="0%" stopColor="#f3d27a" stopOpacity="0.42" />
            <stop offset="38%" stopColor="#c9a227" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#c9a227" stopOpacity="0" />
          </radialGradient>
        </defs>
        <ellipse cx="510" cy="18" rx="170" ry="110" fill="url(#pp-lamp)" />
        <path d="M470 0c18 38 24 62 18 96" stroke="#e8c56a" strokeOpacity="0.18" strokeWidth="1.2" fill="none" />
        <path d="M0 286c80-18 150-8 220 6 90 18 170-10 250 4 70 12 120 8 170-8v42H0z" fill="#0c100d" fillOpacity="0.55" />
        <rect x="430" y="268" width="86" height="8" rx="2" fill="#c9a227" fillOpacity="0.12" />
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
