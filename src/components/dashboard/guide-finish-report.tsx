import { GuideSurface } from "@/components/dashboard/guide-surface";
import { LinkButton } from "@/components/ui/button";
import { guideChildName, guideReportHref } from "@/lib/guide-portal.mjs";
import { formatDayHeading, formatTime } from "@/lib/timezone";
import type { GuideBooking } from "@/lib/guide-portal-types";

export function GuideFinishReport({
  booking,
  tz,
}: {
  booking: GuideBooking;
  tz: string;
}) {
  const when = booking.scheduled_start
    ? `${formatDayHeading(booking.scheduled_start, tz)} · ${formatTime(booking.scheduled_start, tz)}`
    : "Recently";

  return (
    <GuideSurface attention className="px-4 py-3.5">
      <p className="text-[10px] font-semibold tracking-[0.14em] text-[#a15c1a] uppercase">Report needed</p>
      <p className="mt-2 text-[14px] font-medium tracking-[-0.02em] text-[var(--gp-ink)]">
        {guideChildName(booking)} · {when}
      </p>
      <p className="mt-1 text-[13px] leading-5 text-[var(--gp-muted)]">
        Your Study Hall is complete.
        <br />
        Finish the session report.
      </p>
      <div className="mt-4">
        <LinkButton href={guideReportHref(booking.id)} variant="secondary" size="md">
          Complete report →
        </LinkButton>
      </div>
    </GuideSurface>
  );
}
