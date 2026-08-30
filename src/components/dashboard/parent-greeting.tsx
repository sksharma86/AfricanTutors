"use client";

import { useMemo } from "react";

function dayPart(now = new Date()) {
  const hour = now.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function GreetingMark({ evening }: { evening: boolean }) {
  return (
    <span
      aria-hidden
      className="mt-0.5 inline-flex size-8 items-center justify-center rounded-full bg-[#f3e6c4] text-[#c9a227]"
    >
      {evening ? (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
          <path d="M15.2 4.4a7.8 7.8 0 1 0 4.4 13.4 8.6 8.6 0 0 1-4.4-13.4Z" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7">
          <circle cx="12" cy="12" r="3.4" fill="currentColor" stroke="none" />
          <path strokeLinecap="round" d="M12 4.2v1.6M12 18.2v1.6M4.2 12h1.6M18.2 12h1.6M6.4 6.4l1.1 1.1M16.5 16.5l1.1 1.1M6.4 17.6l1.1-1.1M16.5 7.5l1.1-1.1" />
        </svg>
      )}
    </span>
  );
}

export function ParentGreeting({ firstName }: { firstName: string }) {
  const greeting = useMemo(() => dayPart(), []);
  const name = firstName.trim();

  return (
    <div className="flex items-start justify-between gap-4">
      <h1 className="font-display tracking-[-0.035em] text-[var(--pp-ink)]">
        <span className="flex items-center gap-2.5">
          <GreetingMark evening={greeting === "Good evening"} />
          <span className="text-[15px] font-medium text-[var(--pp-muted)] sm:text-base">
            {greeting}
            {name ? "," : ""}
          </span>
        </span>
        <span className="mt-1.5 block text-[1.85rem] font-semibold leading-[1.1] sm:text-[2.15rem]">
          {name || "Welcome"}
        </span>
      </h1>
    </div>
  );
}

export function ParentGreetingSupport() {
  return (
    <p className="mt-2 max-w-md text-sm leading-6 text-[var(--pp-muted)]">
      We’re here to help your kids stay focused and make progress.
    </p>
  );
}
