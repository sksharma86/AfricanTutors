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
      className="inline-flex size-6 items-center justify-center rounded-full bg-[#f3e6c4] text-[#c9a227]"
    >
      {evening ? (
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor">
          <path d="M15.2 4.4a7.8 7.8 0 1 0 4.4 13.4 8.6 8.6 0 0 1-4.4-13.4Z" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.7">
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
    <header className="pp-home-greeting">
      <h1 className="font-display tracking-[-0.03em] text-[var(--pp-ink)]">
        <span className="flex items-center gap-2 text-[13px] font-medium text-[var(--pp-muted)]">
          <GreetingMark evening={greeting === "Good evening"} />
          {greeting}
          {name ? "," : ""}
        </span>
        <span className="mt-0.5 block text-[1.45rem] font-semibold leading-[1.15] sm:text-[1.55rem]">
          {name || "Welcome"}
          {name ? <span aria-hidden> 👋</span> : null}
        </span>
      </h1>
      <p className="mt-1 max-w-lg text-[13px] leading-5 text-[var(--pp-muted)]">
        We’re here to help your kids stay focused and make progress.
      </p>
    </header>
  );
}
