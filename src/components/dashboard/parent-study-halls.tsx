"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { ParentStudyHallRow } from "@/components/dashboard/parent-study-hall-row";
import { parentStudyHallLists } from "@/lib/parent-portal.mjs";
import { cn } from "@/lib/utils";
import type { ParentBooking } from "@/lib/parent-portal-types";

const VIEWS = [
  { id: "upcoming", label: "Upcoming" },
  { id: "past", label: "Past" },
  { id: "cancelled", label: "Cancelled" },
] as const;

export function ParentStudyHalls({ bookings }: { bookings: ParentBooking[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [nowMs] = useState(() => Date.now());
  const view = VIEWS.some((v) => v.id === params.get("view")) ? (params.get("view") as string) : "upcoming";
  const lists = useMemo(() => parentStudyHallLists(bookings, nowMs), [bookings, nowMs]);
  const rows = view === "cancelled" ? lists.cancelled : view === "past" ? lists.past : lists.upcoming;

  function setView(next: string) {
    const sp = new URLSearchParams(params.toString());
    if (next === "upcoming") sp.delete("view");
    else sp.set("view", next);
    router.replace(`${pathname}${sp.toString() ? `?${sp}` : ""}`);
  }

  const empty =
    view === "cancelled"
      ? "Cancelled Study Halls will appear here."
      : view === "past"
        ? "Your completed Study Halls will appear here."
        : "No Study Hall scheduled.";

  return (
    <div>
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
        <div className="mt-6">
          <p className="text-sm text-ink-500">{empty}</p>
          {view === "upcoming" ? (
            <p className="mt-3">
              <Link href="/dashboard/student/book" className="text-sm font-semibold text-gold-700 hover:underline">
                Book a Study Hall
              </Link>
            </p>
          ) : null}
        </div>
      ) : (
        <ul className="mt-2 divide-y divide-ink-100">
          {rows.map((b) => (
            <ParentStudyHallRow key={b.id} booking={b} />
          ))}
        </ul>
      )}
    </div>
  );
}
