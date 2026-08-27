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
    ? `${formatDayHeading(booking.scheduled_start, tz)}${
        booking.scheduled_end || booking.scheduled_start
          ? ` · ${formatTime(booking.scheduled_start, tz)}`
          : ""
      }`
    : "Recently";

  return (
    <GuideSurface>
      <p className="text-[11px] font-semibold tracking-[0.14em] text-gold-700 uppercase">Finish your last Study Hall</p>
      <p className="mt-2 text-sm font-medium text-ink-900">
        {when} · {guideChildName(booking)}
      </p>
      <p className="mt-1 text-sm text-ink-500">Your Study Hall ended before the report was submitted.</p>
      <div className="mt-4">
        <LinkButton href={guideReportHref(booking.id)} variant="primary" size="md">
          Finish report
        </LinkButton>
      </div>
    </GuideSurface>
  );
}
