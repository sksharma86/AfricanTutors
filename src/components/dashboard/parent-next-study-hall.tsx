import Link from "next/link";

import { LinkButton } from "@/components/ui/button";
import { childFirstName, parentGuideLabel, parentJoinHint, parentPrimaryAction } from "@/lib/parent-portal.mjs";
import { formatDayHeading, formatTime } from "@/lib/timezone";
import type { ParentBooking } from "@/lib/parent-portal-types";

const DEFAULT_TZ = "America/Chicago";

export function ParentNextStudyHall({
  next,
  bookings,
}: {
  next: ParentBooking | null;
  bookings: ParentBooking[];
}) {
  const primary = parentPrimaryAction(bookings);
  if (!next) {
    return (
      <section>
        <h2 className="text-sm font-semibold tracking-wide text-ink-400 uppercase">Next Study Hall</h2>
        <p className="mt-3 font-display text-2xl font-semibold text-ink-900">No Study Hall scheduled.</p>
        <p className="mt-2 text-sm leading-6 text-ink-500">Book an hour whenever homework needs structure.</p>
        <div className="mt-5">
          <LinkButton href="/dashboard/student/book" variant="primary" size="lg">
            Book a Study Hall
          </LinkButton>
        </div>
      </section>
    );
  }

  const tz = next.students?.timezone || DEFAULT_TZ;
  const join = parentJoinHint(next);
  const child = childFirstName(next.students?.full_name, "Your child");
  const guide = parentGuideLabel(next);
  const when = next.scheduled_start
    ? `${formatDayHeading(next.scheduled_start, tz)} · ${formatTime(next.scheduled_start, tz)}${
        next.scheduled_end ? ` – ${formatTime(next.scheduled_end, tz)}` : ""
      }`
    : "Time to confirm";

  return (
    <section>
      <h2 className="text-sm font-semibold tracking-wide text-ink-400 uppercase">Next Study Hall</h2>
      <p className="mt-3 font-display text-2xl font-semibold text-ink-900 sm:text-3xl">{when}</p>
      <p className="mt-3 text-lg font-medium text-ink-900">{child}</p>
      {guide ? (
        <p className="mt-1 text-sm text-ink-500">
          Guide
          <span className="mt-0.5 block text-base text-ink-800">{guide}</span>
        </p>
      ) : null}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        {join.state === "join" ? (
          <LinkButton href={`/dashboard/session/${next.id}`} variant="primary" size="lg">
            Join Study Hall
          </LinkButton>
        ) : (
          <>
            {join.label ? <p className="text-sm font-medium text-ink-600">{join.label}</p> : null}
            {primary.kind === "book" ? (
              <LinkButton href="/dashboard/student/book" variant="primary" size="lg">
                Book a Study Hall
              </LinkButton>
            ) : null}
          </>
        )}
      </div>
      <p className="mt-4">
        <Link href={`/dashboard/student/study-halls/${next.id}`} className="text-sm font-medium text-ink-500 hover:text-ink-800">
          View details
        </Link>
      </p>
    </section>
  );
}
