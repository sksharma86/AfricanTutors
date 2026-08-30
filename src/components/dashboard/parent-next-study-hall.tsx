import { ParentIconCalendar } from "@/components/dashboard/parent-icons";
import { ParentSurface } from "@/components/dashboard/parent-surface";
import { LinkButton } from "@/components/ui/button";
import { formatDuration } from "@/lib/format.mjs";
import { bookingChildNames } from "@/lib/household-children.mjs";
import { childFirstName, parentGuideLabel, parentJoinHint } from "@/lib/parent-portal.mjs";
import { formatDayHeading, formatTime } from "@/lib/timezone";
import type { ParentBooking } from "@/lib/parent-portal-types";

const DEFAULT_TZ = "America/Chicago";

function sessionMinutes(booking: ParentBooking) {
  if (booking.duration_minutes) return booking.duration_minutes;
  if (!booking.scheduled_start || !booking.scheduled_end) return null;
  const ms = new Date(booking.scheduled_end).getTime() - new Date(booking.scheduled_start).getTime();
  return ms > 0 ? Math.round(ms / 60000) : null;
}

export function ParentNextStudyHall({
  next,
}: {
  next: ParentBooking | null;
}) {
  if (!next) {
    return (
      <ParentSurface featured>
        <p className="text-[11px] font-semibold tracking-[0.16em] text-gold-300 uppercase">Next Study Hall</p>
        <div className="mt-5 flex items-start gap-3">
          <span className="mt-0.5 inline-flex size-9 items-center justify-center rounded-full bg-white/8 text-gold-300">
            <ParentIconCalendar />
          </span>
          <div>
            <p className="font-display text-[1.65rem] font-semibold tracking-[-0.03em] text-white sm:text-[1.85rem]">
              Nothing scheduled yet
            </p>
            <p className="mt-1.5 text-sm leading-6 text-white/62">
              Book your first Study Hall when you&apos;re ready.
            </p>
          </div>
        </div>
        <div className="mt-6">
          <LinkButton href="/dashboard/student/book" variant="primary" size="lg">
            Book a Study Hall
          </LinkButton>
        </div>
      </ParentSurface>
    );
  }

  const tz = next.students?.timezone || DEFAULT_TZ;
  const join = parentJoinHint(next);
  const child = bookingChildNames(next, childFirstName(next.students?.full_name, "Your child"));
  const guide = parentGuideLabel(next);
  const minutes = sessionMinutes(next);
  const day = next.scheduled_start ? formatDayHeading(next.scheduled_start, tz) : "Time to confirm";
  const time = next.scheduled_start ? formatTime(next.scheduled_start, tz) : "";

  return (
    <ParentSurface featured>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_88%_18%,rgba(201,162,39,0.16),transparent_42%),linear-gradient(160deg,#141a16_0%,#1d2620_58%,#121614_100%)]" />
      <div className="relative">
        <p className="text-[11px] font-semibold tracking-[0.16em] text-gold-300 uppercase">Next Study Hall</p>
        {time ? (
          <p className="mt-4 font-display text-[2.6rem] font-semibold leading-[1.02] tracking-[-0.04em] text-white sm:text-[3.15rem]">
            {time}
          </p>
        ) : (
          <p className="mt-4 font-display text-[1.65rem] font-semibold tracking-[-0.03em] text-white sm:text-[1.85rem]">
            Time to confirm
          </p>
        )}
        <p className="mt-2 text-[15px] text-white/68">
          {day}
          {minutes ? ` · ${formatDuration(minutes)}` : ""}
        </p>
        <div className="mt-6">
          <p className="text-xl font-medium tracking-[-0.02em] text-white">{child}</p>
          {guide ? (
            <p className="mt-1 text-sm text-white/60">
              with Guide <span className="font-medium text-white/82">{guide}</span>
            </p>
          ) : null}
        </div>
        {join.state !== "join" && join.label ? (
          <p className="mt-4 text-sm font-medium text-gold-200">{join.label}</p>
        ) : null}
        {join.state === "join" ? (
          <div className="mt-6">
            <LinkButton href={`/dashboard/session/${next.id}`} variant="secondary" size="lg" className="w-full sm:w-auto">
              Join Study Hall
            </LinkButton>
          </div>
        ) : null}
        <p className="mt-5">
          <LinkButton
            href={`/dashboard/student/study-halls/${next.id}`}
            variant="ghost"
            size="sm"
            className="px-0 text-white/70 hover:bg-transparent hover:text-white"
          >
            View Study Hall
          </LinkButton>
        </p>
      </div>
    </ParentSurface>
  );
}
