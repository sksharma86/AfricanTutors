import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type StatusTone = "positive" | "neutral" | "warning" | "danger" | "info";

const toneClasses: Record<StatusTone, string> = {
  positive: "border-forest-200 bg-forest-50 text-forest-700",
  neutral: "border-ink-200 bg-ink-50 text-ink-600",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  danger: "border-red-200 bg-red-50 text-red-700",
  info: "border-gold-200 bg-gold-50 text-gold-700",
};

export function StatusBadge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: StatusTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
