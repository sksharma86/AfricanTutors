"use client";

import { useEffect, useState } from "react";

import { LinkButton } from "@/components/ui/button";
import { formatTime } from "@/lib/timezone";
import { guideJoinUiState } from "@/lib/tutor-schedule.mjs";

function formatOpenAt(iso: string | null | undefined, tz?: string): string {
  if (!iso) return "5 minutes before start";
  try {
    if (tz) return formatTime(iso, tz);
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "5 minutes before start";
  }
}

/**
 * Guide Join control — UI mirrors the T−5 window; authorize_session_join remains
 * the sole authority when the Guide actually enters the room.
 */
export function GuideJoinControl({
  bookingId,
  status,
  scheduledStart,
  scheduledEnd,
  timezone,
  prominent = false,
  nowMs,
}: {
  bookingId: string;
  status: string;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  timezone?: string;
  prominent?: boolean;
  nowMs?: number;
}) {
  const [liveNow, setLiveNow] = useState(() => Date.now());

  useEffect(() => {
    if (nowMs != null) return;
    const id = window.setInterval(() => setLiveNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, [nowMs]);

  const now = nowMs ?? liveNow;
  const ui = guideJoinUiState(status, scheduledStart, scheduledEnd, now);

  if (ui.kind === "awaiting") {
    return (
      <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
        Awaiting confirmation
      </span>
    );
  }
  if (ui.kind === "join") {
    if (prominent) {
      return (
        <LinkButton href={`/dashboard/session/${bookingId}`} variant="secondary" size="lg" className="w-full sm:w-auto">
          Join Study Hall
        </LinkButton>
      );
    }
    return (
      <LinkButton href={`/dashboard/session/${bookingId}`} variant="secondary" size="sm">
        Join Study Hall
      </LinkButton>
    );
  }
  if (ui.kind === "opens_at") {
    return (
      <p className={prominent ? "text-sm font-medium text-gold-200" : "text-xs font-medium text-ink-500"}>
        Join opens at {formatOpenAt(ui.openAtISO, timezone)}.
      </p>
    );
  }
  if (ui.kind === "ended") {
    return <span className={prominent ? "text-xs font-medium text-white/50" : "text-xs font-medium text-ink-400"}>Session window closed</span>;
  }
  return null;
}
