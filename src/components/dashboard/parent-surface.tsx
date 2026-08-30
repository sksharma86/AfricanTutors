import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Quiet consumer surfaces. Featured is the one Home / detail hero — not a card grid.
 */
export function ParentSurface({
  children,
  featured = false,
  className,
}: {
  children: ReactNode;
  featured?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        featured
          ? "pp-hero relative overflow-hidden rounded-[22px] bg-[#161c18] px-5 py-6 text-[#F6F1E8] shadow-[var(--pp-shadow-2)] before:absolute before:inset-x-0 before:top-0 before:z-10 before:h-[3px] before:bg-gold-400 sm:px-7 sm:py-7"
          : "rounded-[18px] bg-[var(--pp-card)] px-4 py-4 shadow-[var(--pp-shadow-1)] ring-1 ring-[#1c1915]/[0.05] sm:px-5",
        className,
      )}
    >
      {children}
    </div>
  );
}
