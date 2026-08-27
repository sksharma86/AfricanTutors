"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { ManagementStatusPill } from "@/components/dashboard/management-status-pill";
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

export interface StudyHallListRow {
  id: string;
  student_first_name: string | null;
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
}

export function ManagementStudyHalls({
  bookings,
  presenceByBooking,
  attentionBookingIds,
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
  attentionBookingIds: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const tz = useMemo(() => browserTimezone(), []);
  const [nowMs] = useState(() => Date.now());
  const view = VIEWS.some((v) => v.id === params.get("view")) ? (params.get("view") as string) : "today";
  const [q, setQ] = useState(params.get("q") ?? "");
  const [date, setDate] = useState(params.get("date") ?? "");
  const attention = useMemo(() => new Set(attentionBookingIds), [attentionBookingIds]);

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
        attention: attention.has(b.id),
      });
    })
    .map((b) => ({
      booking: b,
      layer: String(
        managementOperationalStatus(b as never, {
          presence: (presenceByBooking[b.id] ?? null) as never,
          nowMs,
          attention: attention.has(b.id),
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

      <form onSubmit={applyFilters} className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Child, parent, Guide, or booking reference"
          className="min-w-0 flex-1 rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm outline-none focus:border-ink-400"
        />
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm outline-none focus:border-ink-400"
        />
        <button type="submit" className="rounded-lg bg-ink-900 px-3 py-2 text-sm font-medium text-white">
          Find
        </button>
      </form>

      {rows.length === 0 ? (
        <p className="py-8 text-sm text-ink-500">No Study Halls in this view.</p>
      ) : (
        <ul className="divide-y divide-ink-100">
          {rows.map(({ booking: b, layer }) => {
            const needsGuide = !b.tutor_id && (b.status === "confirmed" || b.status === "pending");
            const quiet = layer === "completed" || layer === "cancelled";
            return (
              <li key={b.id} className={cn("py-3.5", quiet && "opacity-70")}>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className={cn("text-sm font-medium", quiet ? "text-ink-500" : "text-ink-900")}>
                      {b.scheduled_start ? (
                        <>
                          {formatTime(b.scheduled_start, tz)}
                          {b.scheduled_end ? ` – ${formatTime(b.scheduled_end, tz)}` : null}
                        </>
                      ) : (
                        "Time to confirm"
                      )}
                    </p>
                    <p className={cn("mt-0.5 text-sm", quiet ? "text-ink-400" : "text-ink-800")}>
                      {b.student_first_name ?? "Child"}
                    </p>
                    <p className="text-sm text-ink-500">
                      {needsGuide ? "No Guide" : `Guide: ${b.tutor_display_name ?? "—"}`}
                      {b.parent_name ? ` · Parent: ${b.parent_name}` : null}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <ManagementStatusPill status={layer} />
                    <Link
                      href={`/dashboard/admin/study-halls/${b.id}`}
                      className={cn(
                        "text-sm font-semibold hover:underline",
                        quiet ? "text-ink-400" : "text-gold-700",
                      )}
                    >
                      {needsGuide ? "Assign Guide" : "View"}
                    </Link>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
