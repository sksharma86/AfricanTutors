import type { ReactNode } from "react";

import { Card } from "@/components/ui/card";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";

/**
 * Reusable premium session card for the customer app (next / upcoming / history).
 * Presentational only — actions (join, cancel, report an issue) are passed in.
 */
export function SessionCard({
  subject,
  isFreeTrial,
  whenLabel,
  durationLabel,
  personLabel,
  tutorLabel,
  focus,
  statusLabel,
  statusTone,
  primaryAction,
  secondaryActions,
  featured = false,
  className,
}: {
  subject: string;
  isFreeTrial?: boolean;
  whenLabel?: string;
  durationLabel?: string;
  personLabel?: string;
  tutorLabel?: string;
  focus?: string;
  statusLabel: string;
  statusTone: StatusTone;
  primaryAction?: ReactNode;
  secondaryActions?: ReactNode;
  featured?: boolean;
  className?: string;
}) {
  return (
    <Card
      className={cn(
        "p-5",
        featured && "border-forest-200 bg-forest-50/40 ring-1 ring-forest-100",
        className,
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-xl font-medium text-ink-900">{subject}</h3>
            {isFreeTrial ? (
              <span className="rounded-full bg-gold-100 px-2 py-0.5 text-[10px] font-bold tracking-wide text-gold-700 uppercase">
                Free trial
              </span>
            ) : null}
          </div>
          {whenLabel ? (
            <p className="mt-1.5 flex items-center gap-2 text-sm text-ink-700">
              <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.7} stroke="currentColor" className="h-4 w-4 shrink-0 text-ink-400">
                <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.5 9.5h17M8 3.5v3M16 3.5v3" />
              </svg>
              <span>
                {whenLabel}
                {durationLabel ? <span className="text-ink-400"> · {durationLabel}</span> : null}
              </span>
            </p>
          ) : durationLabel ? (
            <p className="mt-1.5 text-sm text-ink-500">{durationLabel}</p>
          ) : null}
          {personLabel || tutorLabel ? (
            <p className="mt-1 text-sm text-ink-500">
              {[personLabel, tutorLabel].filter(Boolean).join(" · ")}
            </p>
          ) : null}
          {focus ? <p className="mt-1 text-sm text-ink-500">Focus: {focus}</p> : null}
        </div>

        <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
          <StatusBadge tone={statusTone}>{statusLabel}</StatusBadge>
          {primaryAction}
        </div>
      </div>
      {secondaryActions ? <div className="mt-4 border-t border-ink-100 pt-3">{secondaryActions}</div> : null}
    </Card>
  );
}
