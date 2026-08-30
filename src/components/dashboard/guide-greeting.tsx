"use client";

import { useMemo } from "react";

import { guideDayPart } from "@/lib/guide-portal.mjs";

export function GuideGreeting({
  firstName,
  timeZone,
  nowMs,
}: {
  firstName: string;
  timeZone?: string;
  nowMs?: number;
}) {
  const greeting = useMemo(() => guideDayPart(nowMs ?? Date.now(), timeZone), [nowMs, timeZone]);
  const name = firstName.trim();

  return (
    <header className="gp-home-greeting">
      <h1 className="font-display tracking-[-0.03em] text-[var(--gp-ink)]">
        <span className="block text-[1.45rem] font-semibold leading-[1.15] sm:text-[1.55rem]">
          {greeting}
          {name ? `, ${name}` : ""}
          {name ? <span aria-hidden> 👋</span> : null}
        </span>
      </h1>
      <p className="mt-1 text-[13px] leading-5 text-[var(--gp-muted)]">Everything you need for today.</p>
    </header>
  );
}
