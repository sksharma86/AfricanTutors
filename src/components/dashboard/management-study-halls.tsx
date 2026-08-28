"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { ManagementStatusLabel } from "@/components/dashboard/management-status-pill";
import { Button, LinkButton } from "@/components/ui/button";
import { PortalSegmentedControl } from "@/components/ui/portal-segmented-control";
import { bookingChildNames } from "@/lib/household-children.mjs";
import {
  calendarDateInTz,
  managementOperationalStatus,
  matchesStudyHallSearch,
  studyHallViewMembership,
} from "@/lib/management-ops.mjs";
import { browserTimezone, formatTime } from "@/lib/timezone";
import { cn } from "@/lib/utils";

const VIEWS = [
  { id: "today", label: "Today" },
  { id: "upcoming", label: "Upcoming" },
  { id: "attention", label: "Needs Attention" },
  { id: "completed", label: "Completed" },
  { id: "cancelled", label: "Cancelled" },
] as const;

export interface StudyHallIssue {
  kind: string;
  title: string;
  summary: string;
  detail: string | null;
  action: string;
}

export interface StudyHallListRow {
  id: string;
  student_first_name: string | null;
  student_first_names?: string[] | null;
  child_count?: number | null;
  student_full_name?: string | null;
  parent_name?: string | null;
  tutor_display_name: string | null;
  tutor_id: string | null;
  public_reference: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  duration_minutes: number | null;
  status: string;
  payment_status: string;
  is_free_trial: boolean;
  issues?: StudyHallIssue[];
}

export function ManagementStudyHalls({
  bookings,
  presenceByBooking,
}: {
  bookings: StudyHallListRow[];
  presenceByBooking: Record<
    string,
    {
      student_first_joined_at?: string | null;
      tutor_first_joined_at?: string | null;
      student_last_seen_at?: string | null;
      tutor_last_seen_at?: string | null;
      student_last_left_at?: string | null;
      tutor_last_left_at?: string | null;
    }
  >;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const tz = useMemo(() => browserTimezone(), []);
  const [nowMs] = useState(() => Date.now());
  const view = VIEWS.some((v) => v.id === params.get("view")) ? (params.get("view") as string) : "today";
  const [q, setQ] = useState(params.get("q") ?? "");
  const [date, setDate] = useState(params.get("date") ?? "");

  function setView(next: string) {
    const sp = new URLSearchParams(params.toString());
    if (next === "today") sp.delete("view");
    else sp.set("view", next);
    router.replace(`${pathname}${sp.toString() ? `?${sp}` : ""}`);
  }

  function applyFilters(event: React.FormEvent) {
    event.preventDefault();
    const sp = new URLSearchParams(params.toString());
    if (q.trim()) sp.set("q", q.trim());
    else sp.delete("q");
    if (date) sp.set("date", date);
    else sp.delete("date");
    router.replace(`${pathname}${sp.toString() ? `?${sp}` : ""}`);
  }

  const query = params.get("q") ?? "";
  const dateFilter = params.get("date") ?? "";

  const RANK: Record<string, number> = {
    live: 0,
    needs_attention: 1,
    ready: 2,
    completed: 3,
    cancelled: 4,
  };

  const rows = bookings
    .filter((b) => {
      if (!matchesStudyHallSearch(b, query)) return false;
      if (dateFilter && calendarDateInTz(b.scheduled_start, tz) !== dateFilter) return false;
      return studyHallViewMembership(b, view, {
        tz,
        nowMs,
        presence: presenceByBooking[b.id],
        issues: b.issues,
      });
    })
    .map((b) => ({
      booking: b,
      issues: b.issues ?? [],
      layer: String(
        managementOperationalStatus(b as never, {
          presence: (presenceByBooking[b.id] ?? null) as never,
          nowMs,
          issues: b.issues as never,
        }),
      ),
    }))
    .sort((a, b) => {
      const rank = (RANK[a.layer] ?? 9) - (RANK[b.layer] ?? 9);
      if (rank !== 0) return rank;
      return new Date(a.booking.scheduled_start ?? 0).getTime() - new Date(b.booking.scheduled_start ?? 0).getTime();
    });

  return (
    <div className="space-y-6">
      <PortalSegmentedControl
        ariaLabel="Study Hall views"
        items={VIEWS}
        value={view}
        onChange={setView}
      />

      <form onSubmit={applyFilters} className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Child, parent, Guide, or booking reference"
          className="min-h-11 min-w-0 flex-1 rounded-lg border border-ink-200 bg-white px-3 text-sm outline-none focus:border-ink-400"
        />
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="min-h-11 rounded-lg border border-ink-200 bg-white px-3 text-sm outline-none focus:border-ink-400"
        />
        <Button type="submit" variant="primary" size="sm">
          Find
        </Button>
      </form>

      {rows.length === 0 ? (
        <p className="py-8 text-sm text-ink-500">No Study Halls in this view.</p>
      ) : (
        <div>
          <div className="mb-1 hidden grid-cols-[5.5rem_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)_auto] gap-x-4 px-0 text-[11px] font-medium tracking-wide text-ink-400 uppercase sm:grid">
            <span>Time</span>
            <span>Child</span>
            <span>Guide</span>
            <span>Status</span>
            <span className="text-right">Action</span>
          </div>
          <ul className="divide-y divide-ink-100">
            {rows.map(({ booking: b, layer, issues }) => {
              const needsGuide = issues.some((i) => i.kind === "needs_guide" || i.kind === "coverage");
              const quiet = layer === "completed" || layer === "cancelled";
              const action = issues[0]?.action ?? (needsGuide ? "Assign Guide" : "View");
              return (
                <li key={b.id} className={cn("py-3", quiet && "opacity-70")}>
                  <div className="grid grid-cols-1 items-baseline gap-x-4 gap-y-1 sm:grid-cols-[5.5rem_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)_auto]">
                    <p className={cn("text-sm font-medium", quiet ? "text-ink-500" : "text-ink-900")}>
                      {b.scheduled_start ? formatTime(b.scheduled_start, tz) : "—"}
                    </p>
                    <p className={cn("text-sm", quiet ? "text-ink-400" : "text-ink-800")}>
                      {bookingChildNames(b, "Child")}
                    </p>
                    <p className="text-sm text-ink-500">{needsGuide && !b.tutor_display_name ? "No Guide" : b.tutor_display_name ?? "—"}</p>
                    <div className="min-w-0 text-sm">
                      {issues.length === 0 ? (
                        <ManagementStatusLabel status={layer} />
                      ) : issues.length === 1 ? (
                        <p className={cn("font-medium", issues[0].kind === "call_parent" || issues[0].kind === "no_join" ? "text-red-800" : "text-ink-800")}>
                          {issues[0].title}
                        </p>
                      ) : (
                        <div>
                          <p className="font-medium text-ink-800">{issues.length} issues</p>
                          <p className="text-ink-500">{issues.map((i) => i.title).join(" · ")}</p>
                        </div>
                      )}
                    </div>
                    <LinkButton
                      href={`/dashboard/admin/study-halls/${b.id}`}
                      variant={needsGuide || action === "Assign Guide" ? "primary" : "outline"}
                      size="sm"
                      className="sm:justify-self-end"
                    >
                      {action}
                    </LinkButton>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
