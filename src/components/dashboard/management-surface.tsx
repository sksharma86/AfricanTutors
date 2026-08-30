import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function ManagementSurface({
  children,
  command = false,
  attention = false,
  className,
}: {
  children: ReactNode;
  command?: boolean;
  attention?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        command
          ? "mg-command relative overflow-hidden rounded-[18px] bg-[#161c18] px-5 py-4 text-[#F6F1E8] sm:px-5 sm:py-4"
          : attention
            ? "rounded-[14px] bg-[var(--mg-card)] px-4 py-3.5 ring-1 ring-[#c9a227]/30"
            : "rounded-[14px] bg-[var(--mg-card)] px-4 py-3.5 ring-1 ring-[#1c1915]/[0.06]",
        className,
      )}
    >
      {children}
    </div>
  );
}
