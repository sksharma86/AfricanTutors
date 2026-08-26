import type { ElementType, ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Premium surface card: white, hairline border, restrained soft shadow.
 * `interactive` adds a subtle hover lift for clickable cards.
 */
export function Card({
  as: Component = "div",
  interactive = false,
  className,
  children,
}: {
  as?: ElementType;
  interactive?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Component
      className={cn(
        "rounded-[22px] border border-ink-100 bg-surface shadow-[var(--shadow-sm)]",
        interactive && "transition-shadow duration-150 hover:shadow-[0_1px_2px_rgba(19,19,17,0.06),0_12px_32px_-16px_rgba(19,19,17,0.18)]",
        className,
      )}
    >
      {children}
    </Component>
  );
}

export function SectionHeader({
  title,
  action,
  className,
}: {
  title: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-3 flex items-center justify-between", className)}>
      <h2 className="text-sm font-semibold tracking-wide text-ink-500 uppercase">{title}</h2>
      {action}
    </div>
  );
}
