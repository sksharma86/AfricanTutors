"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { ParentStudyHallRow } from "@/components/dashboard/parent-study-hall-row";
import { ParentSurface } from "@/components/dashboard/parent-surface";
import { LinkButton } from "@/components/ui/button";
import { PortalSegmentedControl } from "@/components/ui/portal-segmented-control";
import { parentStudyHallLists } from "@/lib/parent-portal.mjs";
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

  const empty = view === "upcoming" ? "No Study Hall scheduled." : "None yet.";

  return (
    <ParentSurface>
      <PortalSegmentedControl
        ariaLabel="Study Hall views"
        items={VIEWS}
        value={view}
        onChange={setView}
      />
      {rows.length === 0 ? (
        <div className="py-5">
          <p className="text-sm text-ink-500">{empty}</p>
          {view === "upcoming" ? (
            <p className="mt-4">
              <LinkButton href="/dashboard/student/book" variant="primary" size="md">
                Book a Study Hall
              </LinkButton>
            </p>
          ) : null}
        </div>
      ) : (
        <ul className="divide-y divide-ink-100">
          {rows.map((b: ParentBooking) => (
            <ParentStudyHallRow key={b.id} booking={b} past={view !== "upcoming"} />
          ))}
        </ul>
      )}
    </ParentSurface>
  );
}
