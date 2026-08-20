import type { ReactNode } from "react";

import { LinkButton } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Intentional empty state: an icon, a friendly title + line, and an optional
 * primary action. Used across the customer app for zero-data screens.
 */
export function EmptyState({
  icon,
  title,
  description,
  actionHref,
  actionLabel,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  actionHref?: string;
  actionLabel?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-2xl border border-dashed border-ink-200 bg-white px-6 py-10 text-center",
        className,
      )}
    >
      {icon ? (
        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-ink-50 text-ink-400">
          {icon}
        </div>
      ) : null}
      <p className="font-medium text-ink-900">{title}</p>
      {description ? <p className="mt-1 max-w-sm text-sm leading-6 text-ink-500">{description}</p> : null}
      {actionHref && actionLabel ? (
        <LinkButton href={actionHref} variant="primary" size="sm" className="mt-5">
          {actionLabel}
        </LinkButton>
      ) : null}
    </div>
  );
}
