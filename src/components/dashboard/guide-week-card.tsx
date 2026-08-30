import { GuideSurface } from "@/components/dashboard/guide-surface";

export function GuideWeekCard({
  count,
  hours,
  completed,
  upcoming,
}: {
  count: number;
  hours: number;
  completed: number;
  upcoming: number;
}) {
  const hourLabel = hours === 1 ? "1 hour scheduled" : `${hours} hours scheduled`;

  return (
    <GuideSurface className="px-4 py-3.5">
      <p className="text-[10px] font-semibold tracking-[0.14em] text-[var(--gp-muted)] uppercase">This week</p>
      <p className="mt-2 font-display text-[2.15rem] font-semibold leading-none tracking-[-0.045em] text-[var(--gp-ink)]">
        {count}
      </p>
      <p className="mt-1 text-[13px] text-[var(--gp-muted)]">Study Hall{count === 1 ? "" : "s"}</p>
      <p className="mt-3 text-[13px] text-[var(--gp-ink)]">{count === 0 ? "0 scheduled hours" : hourLabel}</p>
      {count > 0 ? (
        <p className="mt-1 text-[12.5px] text-[var(--gp-muted)]">
          {completed} completed · {upcoming} upcoming
        </p>
      ) : null}
    </GuideSurface>
  );
}
