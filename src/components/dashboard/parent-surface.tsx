import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Quiet consumer surfaces. Featured is the one Home anchor — not a card grid.
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
          ? "relative overflow-hidden rounded-[22px] bg-white px-5 py-5 shadow-[0_24px_60px_-32px_rgba(12,12,11,0.42)] ring-1 ring-ink-900/[0.06] before:absolute before:inset-x-0 before:top-0 before:h-[3px] before:bg-gold-400 sm:px-6 sm:py-6"
          : "rounded-2xl bg-white/80 px-4 py-4 ring-1 ring-ink-900/[0.05] sm:px-5",
        className,
      )}
    >
      {children}
    </div>
  );
}
