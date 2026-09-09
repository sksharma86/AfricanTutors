"use client";

import { useEffect, useState } from "react";

import { LinkButton } from "@/components/ui/button";
import { parentJoinHint } from "@/lib/parent-portal.mjs";
import { JOIN_OPEN_LEAD_MIN } from "@/lib/session-window.mjs";

/**
 * Parent Join CTA — UI clock only. authorize_session_join remains the
 * sole authority when the parent actually enters the room.
 */
export function ParentJoinControl({
  bookingId,
  status,
  scheduledStart,
  scheduledEnd,
  canChange = false,
  nowMs,
  prominent = false,
  showSecondary = true,
}: {
  bookingId: string;
  status: string;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  canChange?: boolean;
  nowMs?: number;
  prominent?: boolean;
  showSecondary?: boolean;
}) {
  const [liveNow, setLiveNow] = useState(() => Date.now());

  useEffect(() => {
    if (nowMs != null) return;
    const tick = () => setLiveNow(Date.now());
    const interval = window.setInterval(tick, 15_000);
    let timeout: ReturnType<typeof window.setTimeout> | undefined;
    if (scheduledStart) {
      const openAt = Date.parse(scheduledStart) - JOIN_OPEN_LEAD_MIN * 60_000;
      const delay = openAt - Date.now();
      if (Number.isFinite(delay) && delay > 0 && delay < 24 * 3600_000) {
        timeout = window.setTimeout(tick, delay + 50);
      }
    }
    return () => {
      window.clearInterval(interval);
      if (timeout != null) window.clearTimeout(timeout);
    };
  }, [nowMs, scheduledStart]);

  const now = nowMs ?? liveNow;
  const join = parentJoinHint({ status, scheduled_start: scheduledStart, scheduled_end: scheduledEnd }, now);

  if (join.state === "join") {
    return (
      <LinkButton href={`/dashboard/session/${bookingId}`} variant="secondary" size="lg">
        Join Study Hall →
      </LinkButton>
    );
  }

  if (!showSecondary) {
    return join.label ? (
      <p className={prominent ? "text-sm font-medium text-gold-200" : "text-sm font-medium text-gold-200"}>
        {join.label}
      </p>
    ) : null;
  }

  return (
    <div>
      {join.label ? (
        <p className={prominent ? "mb-3 text-sm font-medium text-gold-200" : "mb-3 text-sm font-medium text-gold-200"}>
          {join.label}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {canChange ? (
          <LinkButton
            href="/dashboard/student/plan-week"
            variant="ghost"
            size="sm"
            className="px-0 text-white/70 hover:bg-transparent hover:text-white"
          >
            Change
          </LinkButton>
        ) : null}
        <LinkButton
          href={`/dashboard/student/study-halls/${bookingId}`}
          variant="ghost"
          size="sm"
          className="px-0 text-white/70 hover:bg-transparent hover:text-white"
        >
          View Study Hall
        </LinkButton>
      </div>
    </div>
  );
}
