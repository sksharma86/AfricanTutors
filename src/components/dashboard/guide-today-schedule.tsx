import { PortalTextLink } from "@/components/ui/portal-text-link";
import { guideChildName, guideRowStatus } from "@/lib/guide-portal.mjs";
import { formatTime } from "@/lib/timezone";
import type { GuideBooking } from "@/lib/guide-portal-types";

export function GuideTodaySchedule({
  rows,
  tz,
}: {
  rows: GuideBooking[];
  tz: string;
}) {
  return (
    <section>
      <p className="text-[11px] font-semibold tracking-[0.14em] text-ink-400 uppercase">{"Today's Study Halls"}</p>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-ink-500">Nothing else on today&apos;s schedule.</p>
      ) : (
        <ul className="mt-3 divide-y divide-ink-100">
          {rows.map((b) => (
            <li key={b.id} className="flex items-baseline justify-between gap-4 py-2.5">
              <p className="min-w-0 text-sm text-ink-800">
                <span className="font-medium tabular-nums text-ink-900">
                  {b.scheduled_start ? formatTime(b.scheduled_start, tz) : "—"}
                </span>
                <span className="mx-3 text-ink-400"> </span>
                <span className="font-medium text-ink-900">{guideChildName(b)}</span>
              </p>
              <span data-kind="status" className="shrink-0 text-sm text-ink-500">
                {guideRowStatus(b)}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3">
        <PortalTextLink href="/dashboard/tutor/study-halls">Upcoming Study Halls</PortalTextLink>
      </p>
    </section>
  );
}
