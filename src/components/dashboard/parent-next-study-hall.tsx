import { ParentSurface } from "@/components/dashboard/parent-surface";
import { LinkButton } from "@/components/ui/button";
import { bookingChildNames } from "@/lib/household-children.mjs";
import { childFirstName, parentGuideLabel, parentJoinHint } from "@/lib/parent-portal.mjs";
import { formatDayHeading, formatTime } from "@/lib/timezone";
import type { ParentBooking } from "@/lib/parent-portal-types";

const DEFAULT_TZ = "America/Chicago";

export function ParentNextStudyHall({
  next,
}: {
  next: ParentBooking | null;
}) {
  if (!next) {
    return (
      <ParentSurface featured>
        <p className="text-[11px] font-semibold tracking-[0.16em] text-gold-700 uppercase">Next Study Hall</p>
        <p className="mt-2 font-display text-[1.65rem] font-semibold tracking-[-0.03em] text-ink-900 sm:text-[1.85rem]">
          No Study Hall scheduled.
        </p>
        <div className="mt-4">
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
  const when = next.scheduled_start
    ? `${formatDayHeading(next.scheduled_start, tz)} · ${formatTime(next.scheduled_start, tz)}${
        next.scheduled_end ? ` – ${formatTime(next.scheduled_end, tz)}` : ""
      }`
    : "Time to confirm";

  return (
    <ParentSurface featured>
      <p className="text-[11px] font-semibold tracking-[0.16em] text-gold-700 uppercase">Next Study Hall</p>
      <p className="mt-2 font-display text-[1.65rem] font-semibold tracking-[-0.03em] text-ink-900 sm:text-[1.85rem]">
        {when}
      </p>
      <div className="mt-3.5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-lg font-medium text-ink-900">{child}</p>
          {guide ? (
            <p className="mt-1 text-sm text-ink-500">
              Guide <span className="font-medium text-ink-800">{guide}</span>
            </p>
          ) : null}
        </div>
        {join.state !== "join" && join.label ? (
          <p className="text-sm font-medium text-ink-600">{join.label}</p>
        ) : null}
      </div>

      {join.state === "join" ? (
        <div className="mt-4">
          <LinkButton href={`/dashboard/session/${next.id}`} variant="primary" size="lg" className="w-full sm:w-auto">
            Join Study Hall
          </LinkButton>
        </div>
      ) : null}
      <p className="mt-3.5">
        <LinkButton href={`/dashboard/student/study-halls/${next.id}`} variant="outline" size="sm">
          View Study Hall
        </LinkButton>
      </p>
    </ParentSurface>
  );
}
