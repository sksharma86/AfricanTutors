"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { GuideJoinControl } from "@/components/dashboard/guide-join-control";
import { GuideSurface } from "@/components/dashboard/guide-surface";
import { TutorCancelRequest } from "@/components/dashboard/tutor-cancel-request";
import { LinkButton } from "@/components/ui/button";
import { PortalSegmentedControl } from "@/components/ui/portal-segmented-control";
import { guideAttendanceRowLabel, guideAttendanceState, obligationBlockContaining } from "@/lib/guide-attendance.mjs";
import {
  guideChildName,
  guideNeedsReport,
  guideReportHref,
  guideReportsDue,
  guideRowStatus,
  guideStudyHallLists,
} from "@/lib/guide-portal.mjs";
import { formatDayHeading, formatTime } from "@/lib/timezone";
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
  nowMs: nowMsProp,
}: {
  bookings: GuideBooking[];
  reportedIds: string[];
  openRequestIds: string[];
  tz: string;
  nowMs?: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [clientNow] = useState(() => Date.now());
  const nowMs = nowMsProp ?? clientNow;
  const view = VIEWS.some((v) => v.id === params.get("view")) ? (params.get("view") as string) : "today";
  const lists = useMemo(() => guideStudyHallLists(bookings, nowMs, tz), [bookings, nowMs, tz]);
  const reported = useMemo(() => new Set(reportedIds), [reportedIds]);
  const openReqs = useMemo(() => new Set(openRequestIds), [openRequestIds]);
  // Upcoming is after today. Today's halls stay on Today so a finished hour
  // is not hidden in a mixed list, and Completed is only the past list.
  const rows = view === "completed" ? lists.completed : view === "upcoming" ? lists.later : lists.today;
  const due = useMemo(() => guideReportsDue(bookings, reported, nowMs), [bookings, reported, nowMs]);

  function setView(next: string) {
    const sp = new URLSearchParams(params.toString());
    if (next === "today") sp.delete("view");
    else sp.set("view", next);
    router.replace(`${pathname}${sp.toString() ? `?${sp}` : ""}`);
  }

  return (
    <GuideSurface>
      <PortalSegmentedControl
        ariaLabel="Study Hall views"
        items={VIEWS}
        value={view}
        onChange={setView}
      />
      {view !== "completed" && due.length > 0 ? (
        <div
          data-kind="reports-due"
          className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[14px] bg-[rgba(201,162,39,0.1)] px-4 py-3 ring-1 ring-[#c9a227]/35"
        >
          <div className="min-w-0">
            <p className="text-[10px] font-semibold tracking-[0.14em] text-[#a15c1a] uppercase">Report needed</p>
            <p className="mt-1 text-sm text-ink-900">
              {due.length === 1
                ? `${guideChildName(due[0])} · ${due[0].scheduled_start ? formatDayHeading(due[0].scheduled_start, tz) : "Recently"} is finished and waiting on your report.`
                : `${due.length} finished Study Halls are waiting on your report.`}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {due.length === 1 ? (
              <LinkButton href={guideReportHref(due[0].id)} variant="primary" size="sm">
                Finish report
              </LinkButton>
            ) : (
              <button
                type="button"
                onClick={() => setView("completed")}
                className="rounded-[12px] bg-ink-900 px-3.5 py-2.5 text-[13px] font-semibold text-white hover:bg-ink-800"
              >
                See completed
              </button>
            )}
          </div>
        </div>
      ) : null}
      {rows.length === 0 ? (
        <p className="py-5 text-sm text-ink-500">
          {view === "completed"
            ? "No completed Study Halls yet. Finished Study Halls appear here once the hour ends."
            : view === "upcoming"
              ? "No upcoming Study Halls after today."
              : "No Study Hall scheduled today."}
        </p>
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
                  <p data-kind="status" className="text-sm text-ink-500">
                    {guideRowStatus(b, nowMs)}
                  </p>
                  {view !== "completed"
                    ? (() => {
                        const block = obligationBlockContaining(bookings, b.id);
                        const own = guideAttendanceState({
                          status: b.status,
                          scheduledStart: block[0]?.scheduled_start ?? b.scheduled_start,
                          assignment: b.attendance ?? null,
                          nowMs,
                        });
                        const label = guideAttendanceRowLabel(own);
                        return label ? (
                          <p data-kind="attendance" className="text-[12.5px] text-ink-500">
                            {label}
                          </p>
                        ) : null;
                      })()
                    : null}
                </div>
                <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
                  {view !== "completed" ? (
                    <GuideJoinControl
                      bookingId={b.id}
                      status={b.status}
                      scheduledStart={b.scheduled_start}
                      scheduledEnd={b.scheduled_end}
                      timezone={tz}
                      nowMs={nowMs}
                    />
                  ) : null}
                  {needs ? (
                    <LinkButton href={guideReportHref(b.id)} variant="primary" size="sm">
                      Finish report
                    </LinkButton>
                  ) : reported.has(b.id) ? (
                    <div className="flex flex-col items-start gap-1 sm:items-end">
                      <span data-kind="status" className="text-sm text-ink-500">
                        Report submitted
                      </span>
                      {view === "completed" ? (
                        <Link
                          href="/dashboard/tutor/earnings"
                          className="text-[13px] font-medium text-ink-800 underline-offset-4 hover:underline"
                        >
                          View earnings →
                        </Link>
                      ) : null}
                    </div>
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
