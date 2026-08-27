"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { GuideJoinControl } from "@/components/dashboard/guide-join-control";
import { GuideSurface } from "@/components/dashboard/guide-surface";
import { TutorCancelRequest } from "@/components/dashboard/tutor-cancel-request";
import {
  guideChildName,
  guideNeedsReport,
  guideReportHref,
  guideRowStatus,
  guideStudyHallLists,
} from "@/lib/guide-portal.mjs";
import { formatDayHeading, formatTime } from "@/lib/timezone";
import { cn } from "@/lib/utils";
import type { GuideBooking } from "@/lib/guide-portal-types";

const VIEWS = [
  { id: "today", label: "Today" },
  { id: "upcoming", label: "Upcoming" },
  { id: "completed", label: "Completed" },
] as const;

export function GuideStudyHalls({
  bookings,
  reportedIds,
  openRequestIds,
  tz,
}: {
  bookings: GuideBooking[];
  reportedIds: string[];
  openRequestIds: string[];
  tz: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [nowMs] = useState(() => Date.now());
  const view = VIEWS.some((v) => v.id === params.get("view")) ? (params.get("view") as string) : "today";
  const lists = useMemo(() => guideStudyHallLists(bookings, nowMs, tz), [bookings, nowMs, tz]);
  const reported = useMemo(() => new Set(reportedIds), [reportedIds]);
  const openReqs = useMemo(() => new Set(openRequestIds), [openRequestIds]);
  const rows = view === "completed" ? lists.completed : view === "upcoming" ? lists.upcoming : lists.today;

  function setView(next: string) {
    const sp = new URLSearchParams(params.toString());
    if (next === "today") sp.delete("view");
    else sp.set("view", next);
    router.replace(`${pathname}${sp.toString() ? `?${sp}` : ""}`);
  }

  return (
    <GuideSurface>
      <div className="flex flex-wrap gap-1 border-b border-ink-100">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => setView(v.id)}
            className={cn(
              "px-3 py-2 text-sm font-medium",
              view === v.id ? "border-b-2 border-ink-900 text-ink-900" : "text-ink-500 hover:text-ink-800",
            )}
          >
            {v.label}
          </button>
        ))}
      </div>
      {rows.length === 0 ? (
        <p className="py-5 text-sm text-ink-500">{view === "completed" ? "None yet." : "No Study Hall scheduled."}</p>
      ) : (
        <ul className="divide-y divide-ink-100">
          {rows.map((b) => {
            const needs = guideNeedsReport(b, reported.has(b.id), nowMs);
            const day = b.scheduled_start ? formatDayHeading(b.scheduled_start, tz) : "—";
            const time = b.scheduled_start
              ? `${formatTime(b.scheduled_start, tz)}${b.scheduled_end ? ` – ${formatTime(b.scheduled_end, tz)}` : ""}`
              : "";
            return (
              <li key={b.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink-900">{day}</p>
                  {time ? <p className="text-sm text-ink-700">{time}</p> : null}
                  <p className="mt-1 text-sm text-ink-800">{guideChildName(b)}</p>
                  <p className="text-sm text-ink-500">{guideRowStatus(b, nowMs)}</p>
                </div>
                <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
                  {view !== "completed" ? (
                    <GuideJoinControl
                      bookingId={b.id}
                      status={b.status}
                      scheduledStart={b.scheduled_start}
                      scheduledEnd={b.scheduled_end}
                      timezone={tz}
                    />
                  ) : null}
                  {needs ? (
                    <Link href={guideReportHref(b.id)} className="text-sm font-medium text-gold-700 hover:underline">
                      Finish report
                    </Link>
                  ) : reported.has(b.id) ? (
                    <span className="text-xs font-medium text-forest-700">Report submitted</span>
                  ) : null}
                  {view !== "completed" && (b.status === "confirmed" || b.status === "pending") ? (
                    <TutorCancelRequest bookingId={b.id} alreadyRequested={openReqs.has(b.id)} />
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </GuideSurface>
  );
}
