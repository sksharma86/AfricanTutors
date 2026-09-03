import type { ReactNode } from "react";

import { GuideSurface } from "@/components/dashboard/guide-surface";

export function GuideCompletedHeader({
  child,
  when,
  children,
}: {
  child: string;
  when: string;
  children?: ReactNode;
}) {
  return (
    <GuideSurface featured>
      <p className="text-[11px] font-semibold tracking-[0.16em] text-gold-300 uppercase">Study Hall complete</p>
      <h1 className="mt-2 font-display text-3xl font-semibold tracking-[-0.03em] text-white">{child}</h1>
      <p className="mt-1 text-sm text-white/68">{when}</p>
      {children}
    </GuideSurface>
  );
}
