"use client";

import { useMemo } from "react";

function dayPart(now = new Date()) {
  const hour = now.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function ParentGreeting({ firstName }: { firstName: string }) {
  const greeting = useMemo(() => dayPart(), []);
  const name = firstName.trim();

  return (
    <h1 className="font-display tracking-[-0.035em] text-[var(--pp-ink)]">
      <span className="block text-[15px] font-medium text-[var(--pp-muted)] sm:text-base">
        {greeting}
        {name ? "," : ""}
      </span>
      <span className="mt-1 block text-[1.85rem] font-semibold leading-[1.1] sm:text-[2rem]">
        {name || "Welcome"}
      </span>
    </h1>
  );
}
