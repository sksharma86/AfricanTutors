import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function GuideSurface({
  children,
  featured = false,
  className,
  attention = false,
}: {
  children: ReactNode;
  featured?: boolean;
  className?: string;
  attention?: boolean;
}) {
  return (
    <div
      className={cn(
        featured
          ? "gp-hero relative overflow-hidden rounded-[22px] bg-[#161c18] px-5 py-5 text-[#F6F1E8] shadow-[var(--gp-shadow-2)] before:absolute before:inset-x-0 before:top-0 before:z-10 before:h-[3px] before:bg-gold-400 sm:px-6 sm:py-5"
          : attention
            ? "rounded-[18px] bg-[var(--gp-card)] px-4 py-3.5 shadow-[var(--gp-shadow-1)] ring-1 ring-[#c9a227]/35 sm:px-5"
            : "rounded-[18px] bg-[var(--gp-card)] px-4 py-3.5 shadow-[var(--gp-shadow-1)] ring-1 ring-[#1c1915]/[0.05] sm:px-5",
        className,
      )}
    >
      {children}
    </div>
  );
}
