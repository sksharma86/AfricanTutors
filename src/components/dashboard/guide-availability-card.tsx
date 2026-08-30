import Link from "next/link";

import { GuideSurface } from "@/components/dashboard/guide-surface";

export function GuideAvailabilityCard({
  availableNow,
  availableToday,
  nextWindow,
  hasSchedule,
}: {
  availableNow: boolean;
  availableToday: boolean;
  nextWindow: { when: string; range: string } | null;
  hasSchedule: boolean;
}) {
  const status = !hasSchedule
    ? "No hours set"
    : availableNow
      ? "Available now"
      : availableToday
        ? "Available today"
        : "Not available today";

  return (
    <GuideSurface className="px-4 py-3.5">
      <p className="text-[10px] font-semibold tracking-[0.14em] text-[var(--gp-muted)] uppercase">Availability status</p>
      <p
        className={
          availableNow || availableToday
            ? "mt-2 text-[15px] font-medium tracking-[-0.02em] text-[#3d6b4f]"
            : "mt-2 text-[15px] font-medium tracking-[-0.02em] text-[var(--gp-ink)]"
        }
      >
        {status}
      </p>
      {nextWindow ? (
        <p className="mt-1 text-[13px] text-[var(--gp-muted)]">
          Next window
          <br />
          {nextWindow.when}, {nextWindow.range}
        </p>
      ) : (
        <p className="mt-1 text-[13px] text-[var(--gp-muted)]">Add weekly hours so families can book you.</p>
      )}
      <p className="mt-3">
        <Link href="/dashboard/tutor/availability" className="text-[13px] font-medium text-[var(--gp-ink)] underline-offset-4 hover:underline">
          Manage availability →
        </Link>
      </p>
    </GuideSurface>
  );
}
