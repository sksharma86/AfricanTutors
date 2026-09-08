"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { ParentSurface } from "@/components/dashboard/parent-surface";
import { Button, LinkButton } from "@/components/ui/button";
import { BOOKING_HORIZON_DAYS, MIN_BOOKING_NOTICE_MINUTES } from "@/lib/booking-config";
import {
  MAX_CHILDREN_PER_STUDY_HALL,
  firstNameOf,
  formatChildNames,
  uniqueStudentIds,
  wouldExceedChildLimit,
} from "@/lib/household-children.mjs";
import { BOOKING_SAME_PRICE_NOTE } from "@/lib/household-pricing-copy.mjs";
import { isHalfHourInstant } from "@/lib/half-hour-grid.mjs";
import { parentCanCancel } from "@/lib/parent-portal.mjs";
import type { ParentBooking } from "@/lib/parent-portal-types";
import { localDateForInstant } from "@/lib/study-hall-365/calendar.mjs";
import {
  PLAN_WEEK_DURATION_MINUTES,
  bookingsByLocalDate,
  formatPlanSessionLine,
  planCopyToNextWeek,
  planningWeek,
  slotsForLocalDate,
} from "@/lib/plan-my-week.mjs";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatTime, tzAbbreviation } from "@/lib/timezone";

export type PlanWeekStudent = {
  id: string;
  full_name: string;
  grade_level: string | null;
  timezone: string;
};

type SessionResult = {
  localDate: string | null;
  startISO: string;
  status: "scheduled" | "already_scheduled" | "needs_payment" | "unavailable" | "error";
  message: string;
  bookingId?: string;
  checkoutUrl?: string;
};

type Picking = { localDate: string; replaceBookingId?: string } | null;

const TECHNICAL = /permission denied|violates|constraint|supabase|stripe|sql|stack|relation|column/i;
function friendly(message?: string | null): string {
  if (!message || TECHNICAL.test(message)) return "Something went wrong. Please try again.";
  return message;
}

function newRequestId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `plan-week-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function PlanMyWeek({
  students,
  bookings,
  timeZone,
}: {
  students: PlanWeekStudent[];
  bookings: ParentBooking[];
  timeZone: string;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const submittingRef = useRef(false);
  const copyingRef = useRef(false);
  const requestIdRef = useRef(newRequestId());

  const [weekOffset, setWeekOffset] = useState(0);
  const [nowMs] = useState(() => Date.now());
  const [studentIds, setStudentIds] = useState<string[]>(students[0]?.id ? [students[0].id] : []);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [replacements, setReplacements] = useState<Record<string, string>>({});
  const [picking, setPicking] = useState<Picking>(null);
  const [slots, setSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [view, setView] = useState<"plan" | "confirm" | "results">("plan");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<SessionResult[] | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [removeNote, setRemoveNote] = useState<string | null>(null);
  const [copyNote, setCopyNote] = useState<string | null>(null);

  const week = useMemo(() => planningWeek(timeZone, new Date(nowMs), weekOffset), [timeZone, nowMs, weekOffset]);
  const byDate = useMemo(
    () => bookingsByLocalDate(bookings, timeZone) as Map<string, ParentBooking[]>,
    [bookings, timeZone],
  );
  const selectedStudents = students.filter((s) => studentIds.includes(s.id));
  const joiningLabel = formatChildNames(
    selectedStudents.map((s) => firstNameOf(s.full_name)).filter(Boolean),
    "Your child",
  );

  const planned = useMemo(() => {
    const items: Array<{ localDate: string; startISO: string; replaceBookingId?: string }> = [];
    for (const [localDate, startISO] of Object.entries(drafts)) {
      if (startISO) items.push({ localDate, startISO });
    }
    for (const [bookingId, startISO] of Object.entries(replacements)) {
      if (!startISO) continue;
      items.push({
        localDate: localDateForInstant(startISO, timeZone),
        startISO,
        replaceBookingId: bookingId,
      });
    }
    return items.sort((a, b) => a.startISO.localeCompare(b.startISO));
  }, [drafts, replacements, timeZone]);

  async function fetchSlots(): Promise<{ list: string[]; error: string | null }> {
    if (!supabase) return { list: [], error: "Something went wrong. Please try again." };
    if (slots.length) return { list: slots, error: null };
    setSlotsLoading(true);
    setSlotsError(null);
    const from = new Date(nowMs + MIN_BOOKING_NOTICE_MINUTES * 60_000).toISOString();
    const to = new Date(nowMs + BOOKING_HORIZON_DAYS * 86_400_000).toISOString();
    const { data, error: e } = await supabase.rpc("get_available_slots", {
      p_subject_id: null,
      p_duration: PLAN_WEEK_DURATION_MINUTES,
      p_from: from,
      p_to: to,
    });
    setSlotsLoading(false);
    if (e) {
      const message = friendly(e.message);
      setSlotsError(message);
      return { list: [], error: message };
    }
    const list = (data ?? [])
      .map((row: { slot_start: string }) => row.slot_start)
      .filter((iso: string) => isHalfHourInstant(iso, timeZone));
    setSlots(list);
    return { list, error: null };
  }

  async function ensureSlots() {
    if (slots.length || slotsLoading) return;
    await fetchSlots();
  }

  async function copyToNextWeek() {
    if (copyingRef.current || submittingRef.current || weekOffset !== 0) return;
    copyingRef.current = true;
    setBusy(true);
    setError(null);
    setCopyNote(null);
    try {
      const fetched = await fetchSlots();
      if (fetched.error && fetched.list.length === 0) {
        setCopyNote("We couldn't check next week's times. Please try again.");
        return;
      }
      const result = planCopyToNextWeek({
        weekOffset,
        bookings,
        drafts,
        replacements,
        slotStarts: fetched.list,
        timeZone,
        nowMs,
      });
      if (result.inapplicable) {
        setCopyNote(result.message);
        return;
      }
      if (Object.keys(result.drafts).length > 0) {
        setDrafts((prev) => ({ ...prev, ...result.drafts }));
        setWeekOffset(1);
      }
      setCopyNote(result.message);
    } catch {
      setCopyNote("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
      copyingRef.current = false;
    }
  }

  async function openPicker(localDate: string, replaceBookingId?: string) {
    setError(null);
    setPicking({ localDate, replaceBookingId });
    await ensureSlots();
  }

  function chooseTime(iso: string) {
    if (!picking) return;
    if (picking.replaceBookingId) {
      setReplacements((prev) => ({ ...prev, [picking.replaceBookingId!]: iso }));
    } else {
      setDrafts((prev) => ({ ...prev, [picking.localDate]: iso }));
    }
    setPicking(null);
  }

  function clearDraft(localDate: string) {
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[localDate];
      return next;
    });
    if (picking?.localDate === localDate && !picking.replaceBookingId) setPicking(null);
  }

  function clearReplacement(bookingId: string) {
    setReplacements((prev) => {
      const next = { ...prev };
      delete next[bookingId];
      return next;
    });
  }

  function toggleChild(id: string) {
    setError(null);
    if (studentIds.includes(id)) {
      if (studentIds.length === 1) return;
      setStudentIds(studentIds.filter((x) => x !== id));
      return;
    }
    if (wouldExceedChildLimit(studentIds, id)) {
      setError("Up to 3 children can join the same Study Hall.");
      return;
    }
    setStudentIds(uniqueStudentIds([...studentIds, id]));
  }

  async function removeBooking(booking: ParentBooking) {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setBusy(true);
    setRemoveNote(null);
    try {
      const res = await fetch("/api/bookings/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId: booking.id }),
      });
      const data = await res.json().catch(() => null);
      setRemovingId(null);
      if (!res.ok) {
        setRemoveNote(friendly(data?.error));
        return;
      }
      clearReplacement(booking.id);
      setRemoveNote("Cancelled. You can pick a new time for that day.");
      router.refresh();
    } finally {
      setBusy(false);
      submittingRef.current = false;
    }
  }

  async function submitWeek() {
    if (submittingRef.current || planned.length === 0) return;
    submittingRef.current = true;
    setBusy(true);
    setError(null);
    const payload = {
      studentIds,
      duration: PLAN_WEEK_DURATION_MINUTES,
      clientRequestId: requestIdRef.current,
      sessions: planned.map((row) => ({
        startISO: row.startISO,
        replaceBookingId: row.replaceBookingId ?? null,
      })),
    };
    try {
      const res = await fetch("/api/plan-week", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-plan-week-request-id": requestIdRef.current,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(friendly(data?.error));
        return;
      }
      setResults((data?.results ?? []) as SessionResult[]);
      setView("results");
      setDrafts({});
      setReplacements({});
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
      submittingRef.current = false;
    }
  }

  const timesForPicker = picking ? slotsForLocalDate(slots, picking.localDate, timeZone, nowMs) : [];

  if (view === "results" && results) {
    return (
      <ParentSurface>
        <p className="text-[11px] font-semibold tracking-[0.16em] text-[var(--pp-muted)] uppercase">Your week</p>
        <h2 className="mt-2 font-display text-2xl font-semibold tracking-[-0.03em] text-[var(--pp-ink)]">
          Study Halls scheduled
        </h2>
        <ul className="mt-4 divide-y divide-[#1c1915]/[0.06]">
          {results.map((row) => (
            <li key={`${row.startISO}-${row.status}`} className="flex flex-wrap items-baseline justify-between gap-2 py-3">
              <p className="text-sm text-[var(--pp-ink)]">{formatPlanSessionLine(row.startISO, timeZone)}</p>
              <p className="text-sm font-medium text-[var(--pp-ink)]">
                {row.status === "scheduled" || row.status === "already_scheduled"
                  ? "Scheduled"
                  : row.status === "needs_payment"
                    ? "Payment needed"
                    : row.message}
              </p>
              {row.status === "needs_payment" && row.checkoutUrl ? (
                <a href={row.checkoutUrl} className="w-full text-[13px] font-medium text-[var(--pp-ink)] underline-offset-4 hover:underline">
                  Complete payment →
                </a>
              ) : null}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm leading-6 text-[var(--pp-muted)]">
          Successful bookings now appear in your usual Study Halls list.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <LinkButton href="/dashboard/student/study-halls" variant="primary">
            View Study Halls
          </LinkButton>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              requestIdRef.current = newRequestId();
              setResults(null);
              setView("plan");
            }}
          >
            Plan another day
          </Button>
        </div>
      </ParentSurface>
    );
  }

  if (view === "confirm") {
    return (
      <ParentSurface>
        <p className="text-[11px] font-semibold tracking-[0.16em] text-[var(--pp-muted)] uppercase">Confirm</p>
        <h2 className="mt-2 font-display text-2xl font-semibold tracking-[-0.03em] text-[var(--pp-ink)]">
          Your Study Hall Week
        </h2>
        <p className="mt-1 text-sm text-[var(--pp-muted)]">{week.label}</p>
        <ul className="mt-4 divide-y divide-[#1c1915]/[0.06]">
          {planned.map((row) => (
            <li key={row.startISO} className="py-3 text-sm text-[var(--pp-ink)]">
              {formatPlanSessionLine(row.startISO, timeZone)}
              {row.replaceBookingId ? (
                <span className="mt-0.5 block text-[12px] text-[var(--pp-muted)]">
                  Replaces the current session after the new time is confirmed. If payment is needed, the current session stays until that payment completes.
                </span>
              ) : null}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm leading-6 text-[var(--pp-muted)]">
          Who is joining: <span className="font-medium text-[var(--pp-ink)]">{joiningLabel}</span>
          . Every Study Hall is 60 minutes. Your available Study Hall benefits and balance will be applied automatically.
        </p>
        {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
        <div className="mt-5 flex flex-wrap gap-3">
          <Button type="button" onClick={submitWeek} disabled={busy || submittingRef.current}>
            {busy ? "Scheduling…" : "Schedule My Week"}
          </Button>
          <Button type="button" variant="outline" onClick={() => setView("plan")} disabled={busy}>
            Back
          </Button>
        </div>
      </ParentSurface>
    );
  }

  return (
    <div className="space-y-4">
      <ParentSurface>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.16em] text-[var(--pp-muted)] uppercase">Week of</p>
            <p className="mt-1 font-display text-xl font-semibold tracking-[-0.03em] text-[var(--pp-ink)]">{week.label}</p>
            <p className="mt-1 text-xs text-[var(--pp-muted)]">Times in {tzAbbreviation(new Date(nowMs).toISOString(), timeZone)}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" disabled={!week.canGoBack} onClick={() => setWeekOffset(0)}>
              This week
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={!week.canGoForward} onClick={() => setWeekOffset(1)}>
              Next week
            </Button>
            {week.weekOffset === 0 ? (
              <Button type="button" variant="outline" size="sm" onClick={copyToNextWeek} disabled={busy}>
                Copy to next week
              </Button>
            ) : null}
          </div>
        </div>
      </ParentSurface>

      {students.length > 1 ? (
        <ParentSurface>
          <p className="text-sm font-medium text-[var(--pp-ink)]">Who is joining these Study Halls?</p>
          <p className="mt-1 text-sm text-[var(--pp-muted)]">{BOOKING_SAME_PRICE_NOTE}</p>
          <div className="mt-3 space-y-2">
            {students.map((s) => {
              const checked = studentIds.includes(s.id);
              return (
                <label
                  key={s.id}
                  className={`flex min-h-11 cursor-pointer items-center justify-between rounded-xl border px-3.5 py-2 text-sm ${
                    checked ? "border-ink-900 bg-ink-50" : "border-ink-200 bg-white"
                  }`}
                >
                  <span className="font-medium text-ink-900">
                    {s.full_name}
                    {s.grade_level ? <span className="ml-2 font-normal text-ink-400">Grade {s.grade_level}</span> : null}
                  </span>
                  <input type="checkbox" checked={checked} onChange={() => toggleChild(s.id)} className="h-4 w-4" />
                </label>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-[var(--pp-muted)]">Applies to new Study Halls you add below. Up to {MAX_CHILDREN_PER_STUDY_HALL} children.</p>
        </ParentSurface>
      ) : students.length === 1 ? (
        <p className="text-sm text-[var(--pp-muted)]">
          Planning for <span className="font-medium text-[var(--pp-ink)]">{students[0].full_name}</span>
        </p>
      ) : (
        <p className="text-sm text-[var(--pp-muted)]">
          Add a child in{" "}
          <a href="/dashboard/student/book" className="font-medium text-[var(--pp-ink)] underline-offset-4 hover:underline">
            Book a Study Hall
          </a>{" "}
          first.
        </p>
      )}

      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {copyNote ? <p className="text-sm text-[var(--pp-muted)]">{copyNote}</p> : null}
      {removeNote ? <p className="text-sm text-[var(--pp-muted)]">{removeNote}</p> : null}

      <div className="space-y-2 pb-24">
        {week.days.map((day) => {
          const dateKey = day.localDate;
          const existing = byDate.get(dateKey) ?? [];
          const draft = drafts[dateKey] ?? "";
          const isPicking = picking?.localDate === dateKey;
          return (
            <ParentSurface key={dateKey} className="px-4 py-3.5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[var(--pp-ink)]">{day.weekdayLong}</p>
                  <p className="text-[13px] text-[var(--pp-muted)]">{day.monthDay}</p>
                </div>
                {day.isPast ? (
                  <p className="text-[13px] text-[var(--pp-muted)]">Passed</p>
                ) : existing.length === 0 && !draft ? (
                  <Button type="button" variant="outline" size="sm" onClick={() => openPicker(dateKey)} disabled={!studentIds.length}>
                    Add Study Hall
                  </Button>
                ) : null}
              </div>

              {existing.map((booking: ParentBooking) => {
                const nextStart = replacements[booking.id];
                const canCancel = parentCanCancel(booking, nowMs);
                const hoursUntil = booking.scheduled_start
                  ? (new Date(booking.scheduled_start).getTime() - nowMs) / 3_600_000
                  : null;
                return (
                  <div key={booking.id} className="mt-3 border-t border-[#1c1915]/[0.06] pt-3">
                    <p className="text-sm font-medium text-[var(--pp-ink)]">
                      {booking.scheduled_start ? formatTime(booking.scheduled_start, timeZone) : "Scheduled"}
                      {nextStart ? (
                        <span className="font-normal text-[var(--pp-muted)]"> → {formatTime(nextStart, timeZone)} (change pending)</span>
                      ) : null}
                    </p>
                    {removingId === booking.id ? (
                      <div className="mt-2 rounded-xl border border-ink-200 bg-white p-3">
                        <p className="text-sm font-medium text-ink-900">Cancel this session?</p>
                        <p className="mt-1 text-xs leading-5 text-ink-500">
                          {hoursUntil !== null && hoursUntil < 24
                            ? "This session starts within 24 hours, so cancelling will forfeit the session value."
                            : "Cancelling 24+ hours ahead returns the session value to your account, per our policy."}
                        </p>
                        <p className="mt-1 text-xs text-ink-500">After it is removed, you can pick a replacement time for this day.</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button type="button" variant="destructive" size="sm" onClick={() => removeBooking(booking)} disabled={busy}>
                            {busy ? "Cancelling…" : "Yes, cancel"}
                          </Button>
                          <Button type="button" variant="outline" size="sm" onClick={() => setRemovingId(null)} disabled={busy}>
                            Keep session
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {canCancel ? (
                          <Button type="button" variant="outline" size="sm" onClick={() => openPicker(dateKey, booking.id)}>
                            Change
                          </Button>
                        ) : null}
                        {canCancel ? (
                          <Button type="button" variant="ghost" size="sm" onClick={() => setRemovingId(booking.id)}>
                            Remove
                          </Button>
                        ) : null}
                        {nextStart ? (
                          <Button type="button" variant="ghost" size="sm" onClick={() => clearReplacement(booking.id)}>
                            Keep original time
                          </Button>
                        ) : null}
                      </div>
                    )}
                  </div>
                );
              })}

              {draft && existing.length === 0 ? (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#1c1915]/[0.06] pt-3">
                  <p className="text-sm font-medium text-[var(--pp-ink)]">{formatTime(draft, timeZone)}</p>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => openPicker(dateKey)}>
                      Change
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => clearDraft(dateKey)}>
                      Remove
                    </Button>
                  </div>
                </div>
              ) : null}

              {isPicking ? (
                <div className="mt-3 border-t border-[#1c1915]/[0.06] pt-3">
                  <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">Available start times</p>
                  {slotsLoading ? (
                    <p className="mt-2 text-sm text-[var(--pp-muted)]">Finding available Study Hall times…</p>
                  ) : slotsError ? (
                    <p className="mt-2 text-sm text-red-700">{slotsError}</p>
                  ) : timesForPicker.length === 0 ? (
                    <p className="mt-2 text-sm text-[var(--pp-muted)]">No available times for this day.</p>
                  ) : (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {timesForPicker.map((iso: string) => (
                        <button
                          key={iso}
                          type="button"
                          onClick={() => chooseTime(iso)}
                          className="min-h-11 rounded-xl border border-ink-200 bg-white px-3.5 text-sm font-medium text-ink-800 hover:border-ink-300"
                        >
                          {formatTime(iso, timeZone)}
                        </button>
                      ))}
                    </div>
                  )}
                  <Button type="button" variant="ghost" size="sm" className="mt-2 px-0" onClick={() => setPicking(null)}>
                    Cancel
                  </Button>
                </div>
              ) : null}
            </ParentSurface>
          );
        })}
      </div>

      <div className="sticky bottom-3 z-10">
        <ParentSurface className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-[var(--pp-muted)]">
            {planned.length === 0
              ? "Add one or more days, then review."
              : `${planned.length} Study Hall${planned.length === 1 ? "" : "s"} ready to schedule`}
          </p>
          <Button type="button" disabled={planned.length === 0 || !studentIds.length} onClick={() => setView("confirm")}>
            Review week
          </Button>
        </ParentSurface>
      </div>
    </div>
  );
}
