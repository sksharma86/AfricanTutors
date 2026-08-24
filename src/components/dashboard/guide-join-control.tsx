"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { guideJoinUiState } from "@/lib/tutor-schedule.mjs";

function formatOpenAt(iso: string | null | undefined): string {
  if (!iso) return "5 minutes before start";
  try {
    return new Date(iso).toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
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
}: {
  bookingId: string;
  status: string;
  scheduledStart: string | null;
  scheduledEnd: string | null;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const ui = guideJoinUiState(status, scheduledStart, scheduledEnd, now);

  if (ui.kind === "awaiting") {
    return (
      <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
        Awaiting confirmation
      </span>
    );
  }
  if (ui.kind === "join") {
    return (
      <Link
        href={`/dashboard/session/${bookingId}`}
        className="rounded-lg bg-gold-400 px-3 py-1.5 text-xs font-semibold text-ink-900 hover:bg-gold-300"
      >
        Join Study Hall
      </Link>
    );
  }
  if (ui.kind === "opens_at") {
    return (
      <div className="text-right">
        <span className="inline-block rounded-lg border border-ink-200 bg-ink-50 px-3 py-1.5 text-xs font-medium text-ink-500">
          Join opens soon
        </span>
        <p className="mt-1 max-w-[11rem] text-[11px] leading-4 text-ink-400">
          Available at {formatOpenAt(ui.openAtISO)} (5 min before start)
        </p>
      </div>
    );
  }
  if (ui.kind === "ended") {
    return <span className="text-xs font-medium text-ink-400">Session window closed</span>;
  }
  return null;
}
