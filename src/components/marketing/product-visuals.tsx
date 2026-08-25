/**
 * Marketing-only product UI representations — illustrative, not live data.
 * Labels and captions explain what first-time parents are looking at.
 */

import type { ReactNode } from "react";

function MockCaption({ children }: { children: ReactNode }) {
  return <p className="mt-2.5 text-center text-[12px] font-medium tracking-[-0.01em] text-ink-400">{children}</p>;
}

export function ProductSessionCard({ className = "" }: { className?: string }) {
  return (
    <div className={`rounded-[18px] bg-white p-5 mkt-depth ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold tracking-[-0.01em] text-ink-500">Upcoming Study Hall</p>
        <span className="rounded-full bg-forest-50 px-2.5 py-0.5 text-[11px] font-semibold text-forest-700">
          Confirmed
        </span>
      </div>
      <p className="mt-3 text-[22px] font-semibold tracking-[-0.04em] text-ink-900">Tonight · 6:30 – 7:30 PM</p>
      <p className="mt-1 text-sm text-ink-500">Maya · 60 minutes</p>
      <div className="mt-5 flex items-center gap-3 border-t border-ink-100 pt-4">
        <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-ink-900 text-xs font-semibold text-white">
          G
          <span className="absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-forest-500" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ink-900">Guide ready</p>
          <p className="text-xs text-ink-400">Join opens 5 minutes before start</p>
        </div>
        <span className="rounded-[10px] bg-ink-900 px-3 py-2 text-xs font-semibold text-white">Join</span>
      </div>
    </div>
  );
}

export function ProductLivePanel({ className = "" }: { className?: string }) {
  return (
    <div className={`overflow-hidden rounded-[18px] bg-ink-900 text-white mkt-depth ${className}`}>
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-forest-400" />
          <p className="text-xs font-semibold text-white/85">Live Study Hall</p>
        </div>
        <p className="text-[11px] text-white/45">42:18</p>
      </div>
      <div className="grid grid-cols-[1.15fr_0.85fr] gap-3 p-4">
        <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-ink-800">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,rgba(233,183,84,0.18),transparent_55%)]" />
          <div className="absolute inset-x-0 bottom-0 p-3">
            <p className="text-xs font-medium text-white/90">Maya</p>
            <p className="text-[11px] text-white/45">Working · Algebra homework</p>
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <div className="relative flex-1 overflow-hidden rounded-xl bg-ink-800">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_60%_30%,rgba(46,106,72,0.25),transparent_50%)]" />
            <div className="absolute inset-x-0 bottom-0 p-2.5">
              <p className="text-[11px] font-medium text-white/85">Guide</p>
            </div>
          </div>
          <div className="rounded-xl bg-white/5 px-3 py-2.5">
            <p className="text-[10px] tracking-wide text-white/40 uppercase">Focus</p>
            <p className="mt-0.5 text-xs font-medium text-white/90">On task</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ProductReportCard({ className = "" }: { className?: string }) {
  return (
    <div className={`rounded-[18px] bg-white p-5 mkt-depth-sm ${className}`}>
      <p className="text-[11px] font-semibold text-ink-400">Session report</p>
      <div className="mt-2 flex items-baseline justify-between gap-3">
        <p className="text-sm font-semibold tracking-[-0.02em] text-ink-900">Maya’s Study Hall</p>
        <p className="text-xs text-ink-400">Tue · 60 min</p>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <dt className="text-[10px] font-medium tracking-wide text-ink-400 uppercase">Focus</dt>
          <dd className="mt-0.5 text-sm text-ink-800">Strong focus</dd>
        </div>
        <div>
          <dt className="text-[10px] font-medium tracking-wide text-ink-400 uppercase">Redirection</dt>
          <dd className="mt-0.5 text-sm text-ink-800">Light</dd>
        </div>
      </dl>
      <p className="mt-4 text-sm leading-6 text-ink-500">
        Finished math worksheet and started reading. Stayed with the work after one calm redirect.
      </p>
      <div className="mt-4 flex items-center justify-between border-t border-ink-100 pt-3">
        <p className="text-xs text-ink-500">
          Session recording · <span className="font-medium text-ink-700">Available for 60 days</span>
        </p>
        <span className="text-xs font-semibold text-ink-800">Watch</span>
      </div>
    </div>
  );
}

export function ProductHoursCard({ className = "" }: { className?: string }) {
  return (
    <div className={`rounded-[18px] bg-white p-5 mkt-depth-sm ${className}`}>
      <p className="text-[11px] font-semibold text-ink-400">Prepaid hours</p>
      <p className="mt-2 text-[28px] font-semibold tracking-[-0.04em] text-ink-900">11h 30m</p>
      <p className="mt-1 text-sm text-ink-500">Hours never expire</p>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-ink-100">
        <div className="h-full w-[72%] rounded-full bg-ink-900" />
      </div>
      <p className="mt-3 text-xs font-medium text-forest-700">28 Hour Routine · $9/hour effective</p>
    </div>
  );
}

export function ProductStreakCard({ className = "" }: { className?: string }) {
  return (
    <div className={`rounded-[18px] border border-ink-100 bg-white p-5 mkt-depth-sm ${className}`}>
      <p className="text-[11px] font-semibold text-ink-400">Study Hall streak</p>
      <p className="mt-2 text-[22px] font-semibold tracking-[-0.04em] text-ink-900">5 days in a row</p>
      <p className="mt-2 text-sm leading-6 text-ink-500">
        Maya has successfully attended Study Hall 5 days in a row. She’s building great study habits.
      </p>
      <p className="mt-4 text-sm font-semibold text-ink-900">Book for tomorrow →</p>
    </div>
  );
}

/** Calm Call Parent illustration for parent-portal storytelling. */
export function ProductCallParentCard({ className = "" }: { className?: string }) {
  return (
    <div className={`rounded-[18px] border border-ink-100 bg-white p-5 mkt-depth-sm ${className}`}>
      <p className="text-[11px] font-semibold text-ink-400">When they need you</p>
      <p className="mt-2 text-lg font-semibold tracking-[-0.03em] text-ink-900">Call Parent</p>
      <p className="mt-2 text-sm leading-6 text-ink-500">
        If your child needs you during Study Hall, their Guide can reach you through Study Hall at
        Home — without seeing your private phone number.
      </p>
      <div className="mt-4 flex items-center gap-3 rounded-[12px] bg-surface-muted/80 px-3.5 py-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink-900 text-[11px] font-semibold text-white">
          G
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ink-900">Guide initiated Call Parent</p>
          <p className="text-xs text-ink-400">Your number stays private</p>
        </div>
        <span className="rounded-full bg-forest-50 px-2.5 py-1 text-[11px] font-semibold text-forest-700">
          Connected
        </span>
      </div>
    </div>
  );
}

/**
 * Hero composition: upcoming session + live Study Hall, with clear product context.
 */
export function HeroProductVisual() {
  return (
    <div className="relative mx-auto w-full max-w-md lg:max-w-none">
      <p className="at-fade-in at-delay-1 mb-3 text-[12px] font-semibold tracking-[-0.01em] text-ink-400">
        What Study Hall looks like
      </p>
      <div className="at-fade-in at-delay-2 relative z-10">
        <ProductSessionCard />
        <MockCaption>In your parent account · book and join from here</MockCaption>
      </div>
      <div className="at-fade-in at-delay-3 relative z-0 mt-5 sm:mt-6 lg:mt-4 lg:ml-10">
        <div className="at-float">
          <ProductLivePanel />
        </div>
        <MockCaption>During the session · Guide keeps your child on task</MockCaption>
      </div>
    </div>
  );
}
