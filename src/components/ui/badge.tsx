import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-medium tracking-wide text-brand-700 uppercase",
        className,
      )}
    >
      {children}
    </span>
  );
}
