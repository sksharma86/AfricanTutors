import { GuideSurface } from "@/components/dashboard/guide-surface";

export function GuideGuidance() {
  return (
    <GuideSurface className="px-4 py-3.5">
      <p className="text-[10px] font-semibold tracking-[0.14em] text-[var(--gp-muted)] uppercase">During Study Hall</p>
      <p className="mt-2 text-[12.5px] leading-5 text-[var(--gp-muted)]">
        Your role: presence, focus, accountability, and calm redirection — not tutoring or homework answers. Ready to
        join 5 minutes before start.
      </p>
      <ul className="mt-2.5 grid gap-3 sm:grid-cols-3">
        <li>
          <p className="text-[13px] font-medium text-[var(--gp-ink)]">Be present</p>
          <p className="mt-0.5 text-[12.5px] leading-5 text-[var(--gp-muted)]">
            Stay visible on camera and keep students focused.
          </p>
        </li>
        <li>
          <p className="text-[13px] font-medium text-[var(--gp-ink)]">Use Call Parent</p>
          <p className="mt-0.5 text-[12.5px] leading-5 text-[var(--gp-muted)]">
            If a parent is needed, use Call Parent. Their number stays private.
          </p>
        </li>
        <li>
          <p className="text-[13px] font-medium text-[var(--gp-ink)]">Complete your report</p>
          <p className="mt-0.5 text-[12.5px] leading-5 text-[var(--gp-muted)]">
            Finish the required session report after every Study Hall.
          </p>
        </li>
      </ul>
    </GuideSurface>
  );
}
