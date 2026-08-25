/**
 * Marketing product UI — illustrative, composed as one product surface.
 * Call Parent uses telephony; parents do NOT need the portal open.
 */

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

function Frame({
  label,
  children,
  className,
  dark = false,
}: {
  label: string;
  children: ReactNode;
  className?: string;
  dark?: boolean;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl",
        dark ? "bg-ink-900 text-white" : "border border-ink-100 bg-white",
        className,
      )}
    >
      <div
        className={cn(
          "flex items-center justify-between px-4 py-2.5 sm:px-5",
          dark ? "border-b border-white/10" : "border-b border-ink-100",
        )}
      >
        <p
          className={cn(
            "text-[11px] font-semibold tracking-[-0.01em]",
            dark ? "text-white/65" : "text-ink-500",
          )}
        >
          {label}
        </p>
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </div>
  );
}

function UpcomingBody() {
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[1.25rem] font-semibold tracking-[-0.04em] text-ink-900 sm:text-[1.375rem]">
            Tonight · 6:30–7:30 PM
          </p>
          <p className="mt-1 text-sm text-ink-500">Maya · 60 minutes</p>
        </div>
        <span className="shrink-0 pt-1 text-[11px] font-medium text-forest-700">Confirmed</span>
      </div>
      <div className="mt-5 flex items-center gap-3 border-t border-ink-100 pt-4">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink-900 text-[11px] font-semibold text-white">
          G
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ink-900">Guide ready</p>
          <p className="text-xs text-ink-400">Join opens 5 minutes before start</p>
        </div>
        <span className="rounded-md bg-ink-900 px-3 py-1.5 text-xs font-semibold text-white">Join</span>
      </div>
    </>
  );
}

function LiveBody() {
  return (
    <>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-forest-400" />
          <p className="text-xs font-medium text-white/75">In session</p>
        </div>
        <p className="font-mono text-[11px] tabular-nums text-white/40">42:18</p>
      </div>
      <div className="grid grid-cols-[1.25fr_0.75fr] gap-2.5">
        <div className="relative aspect-[5/4] overflow-hidden rounded-lg bg-ink-800">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_35%_40%,rgba(201,136,22,0.12),transparent_55%)]" />
          <div className="absolute inset-x-0 bottom-0 p-2.5">
            <p className="text-xs font-medium text-white/90">Maya</p>
            <p className="text-[11px] text-white/40">Working · homework</p>
          </div>
        </div>
        <div className="flex flex-col gap-2.5">
          <div className="relative min-h-[4.25rem] flex-1 overflow-hidden rounded-lg bg-ink-800">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_60%_30%,rgba(46,106,72,0.2),transparent_55%)]" />
            <div className="absolute inset-x-0 bottom-0 p-2.5">
              <p className="text-[11px] font-medium text-white/75">Guide</p>
            </div>
          </div>
          <div className="rounded-lg bg-white/[0.06] px-3 py-2.5">
            <p className="text-[10px] font-medium tracking-wide text-white/35 uppercase">Focus</p>
            <p className="mt-0.5 text-xs font-medium text-white/90">On task</p>
          </div>
        </div>
      </div>
    </>
  );
}

export function ProductSessionCard({ className = "" }: { className?: string }) {
  return (
    <Frame label="Upcoming Study Hall" className={className}>
      <UpcomingBody />
    </Frame>
  );
}

export function ProductLivePanel({ className = "" }: { className?: string }) {
  return (
    <Frame label="Live Study Hall" dark className={className}>
      <LiveBody />
    </Frame>
  );
}

export function ProductReportCard({ className = "" }: { className?: string }) {
  return (
    <Frame label="Session report" className={className}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[15px] font-semibold tracking-[-0.02em] text-ink-900">Maya’s Study Hall</p>
        <p className="shrink-0 text-xs text-ink-400">Tue · 60 min</p>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <dt className="text-[11px] text-ink-400">Focus</dt>
          <dd className="mt-0.5 text-sm text-ink-800">Strong</dd>
        </div>
        <div>
          <dt className="text-[11px] text-ink-400">Redirection</dt>
          <dd className="mt-0.5 text-sm text-ink-800">Light</dd>
        </div>
      </dl>
      <p className="mt-4 text-sm leading-6 text-ink-500">
        Finished math, then reading. Stayed with the work after one calm redirect.
      </p>
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-ink-100 pt-3">
        <p className="text-xs text-ink-500">
          Recording · <span className="font-medium text-ink-800">60 days</span>
        </p>
        <span className="text-xs font-semibold text-ink-900">Watch</span>
      </div>
    </Frame>
  );
}

export function ProductHoursCard({ className = "" }: { className?: string }) {
  return (
    <Frame label="Prepaid hours" className={className}>
      <p className="text-[1.75rem] font-semibold tracking-[-0.04em] text-ink-900">11h 30m</p>
      <p className="mt-1 text-sm text-ink-500">Hours never expire</p>
      <div className="mt-4 h-1 overflow-hidden rounded-full bg-ink-100">
        <div className="h-full w-[72%] rounded-full bg-ink-900" />
      </div>
      <p className="mt-3 text-xs text-ink-500">28 Hour Routine · $9/hour effective</p>
    </Frame>
  );
}

export function ProductStreakCard({ className = "" }: { className?: string }) {
  return (
    <Frame label="Study Hall streak" className={className}>
      <p className="text-[1.375rem] font-semibold tracking-[-0.04em] text-ink-900">5 days in a row</p>
      <p className="mt-2 text-sm leading-6 text-ink-500">
        Maya attended Study Hall five days running. She’s building a solid homework habit.
      </p>
      <p className="mt-4 text-sm font-semibold text-ink-900">Book for tomorrow →</p>
    </Frame>
  );
}

/**
 * Call Parent — telephony to the parent’s phone. Guide never sees the number.
 * Parent does not need the portal open.
 */
export function ProductCallParentCard({ className = "" }: { className?: string }) {
  return (
    <Frame label="Call Parent" className={className}>
      <p className="text-[1.0625rem] font-semibold tracking-[-0.03em] text-ink-900">
        Step away without being out of reach.
      </p>
      <p className="mt-2 text-sm leading-6 text-ink-500">
        If your child needs you, their Guide can use Call Parent. Study Hall at Home contacts your
        phone — your number stays private.
      </p>
      <div className="mt-4 flex items-center gap-3 rounded-lg bg-ink-50 px-3.5 py-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink-900 text-[11px] font-semibold text-white">
          G
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ink-900">Calling parent…</p>
          <p className="text-xs text-ink-400">Number hidden from Guide</p>
        </div>
      </div>
    </Frame>
  );
}

/** Hero: one composed product surface — upcoming + live, no floating offsets. */
export function HeroProductVisual() {
  return (
    <div className="at-fade-in at-delay-2 mx-auto w-full max-w-[26rem] lg:max-w-none">
      <div className="overflow-hidden rounded-2xl border border-ink-100 bg-white mkt-depth-sm">
        <div className="flex items-center gap-1.5 border-b border-ink-100 px-4 py-2.5">
          <span className="h-1.5 w-1.5 rounded-full bg-ink-200" aria-hidden />
          <span className="h-1.5 w-1.5 rounded-full bg-ink-200" aria-hidden />
          <span className="h-1.5 w-1.5 rounded-full bg-ink-200" aria-hidden />
          <p className="ml-2 text-[11px] font-medium text-ink-400">Study Hall at Home</p>
        </div>

        <div className="border-b border-ink-100 px-4 py-4 sm:px-5 sm:py-5">
          <p className="text-[11px] font-semibold tracking-[-0.01em] text-ink-500">Upcoming Study Hall</p>
          <div className="mt-3">
            <UpcomingBody />
          </div>
        </div>

        <div className="bg-ink-900 px-4 py-4 text-white sm:px-5 sm:py-5">
          <p className="text-[11px] font-semibold tracking-[-0.01em] text-white/65">Live Study Hall</p>
          <div className="mt-3">
            <LiveBody />
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 px-0.5 text-[12px] leading-5 text-ink-400">
        <span>Parent account · book &amp; join</span>
        <span aria-hidden className="text-ink-200">
          ·
        </span>
        <span>Live session · Guide keeps them on task</span>
      </div>
    </div>
  );
}
