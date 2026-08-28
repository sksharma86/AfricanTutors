"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { ANALYTICS_EVENTS, track } from "@/lib/analytics";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { BOOKING_HORIZON_DAYS, MIN_BOOKING_NOTICE_MINUTES } from "@/lib/booking-config";
import { FREE_TRIAL_MINUTES, SESSION_OPTIONS, formatUsd, type StudyHallDuration } from "@/lib/pricing";
import { formatDuration, formatMoneyCents } from "@/lib/format.mjs";
import {
  durationOptionPriceLabel,
  isFullyPrepaidQuote,
  prepaidCoversDuration,
  remainingBalanceMinutes,
} from "@/lib/booking-prepaid-display.mjs";
import {
  MAX_CHILDREN_PER_STUDY_HALL,
  firstNameOf,
  formatChildNames,
  uniqueStudentIds,
  wouldExceedChildLimit,
} from "@/lib/household-children.mjs";
import { COMMON_TIMEZONES, browserTimezone, formatDayHeading, formatTime, tzAbbreviation } from "@/lib/timezone";

export interface StudentRow {
  id: string;
  full_name: string;
  grade_level: string | null;
  timezone: string;
}

/** Kept for book-page / admin compat; Study Hall booking does not use subjects. */
export interface SubjectRow {
  id: string;
  name: string;
  category: string;
}

const GRADE_OPTIONS = ["6", "7", "8", "9", "10", "11", "12", "College"];

// Only surface parent-friendly messages; never leak DB/SQL/security internals.
const TECHNICAL_ERROR = /permission denied|violates|constraint|null value|relation|column|function|syntax|jwt|supabase|fetch failed|network|exclusion|duplicate key|rls|policy/i;
function friendlyError(message?: string | null): string {
  if (!message || TECHNICAL_ERROR.test(message)) {
    return "Something went wrong. Please try again.";
  }
  return message;
}

type Step = "student" | "duration" | "time" | "confirm" | "done";

interface Quote {
  session_price_cents: number;
  is_free_trial: boolean;
  package_minutes_used: number;
  credit_cents_used: number;
  stripe_cents_due: number;
  funding: string;
}

export function BookingWizard({
  students: initialStudents,
  subjects: _subjects = [],
  initialDuration = 60,
}: {
  students: StudentRow[];
  /** Unused — Study Hall books without a subject. Kept optional for page compat. */
  subjects?: SubjectRow[];
  initialDuration?: StudyHallDuration;
}) {
  void _subjects;
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [students, setStudents] = useState<StudentRow[]>(initialStudents);
  const [step, setStep] = useState<Step>("student");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submittingRef = useRef(false);

  const [studentIds, setStudentIds] = useState<string[]>(
    initialStudents[0]?.id ? [initialStudents[0].id] : [],
  );
  const [childLimitMessage, setChildLimitMessage] = useState<string | null>(null);
  const [freeTrialUsed, setFreeTrialUsed] = useState<boolean | null>(null);

  const [note, setNote] = useState("");

  // Duration may be preselected from the Pricing page ("Book 1/2/3 hours").
  // This is display state only — it never sets price or bypasses the free-trial
  // option, which the duration step still presents when the account is eligible.
  const [duration, setDuration] = useState<StudyHallDuration>(initialDuration);
  const [isFreeTrial, setIsFreeTrial] = useState(false);

  const [slots, setSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);
  /** Collapse long 21-day strips so parents aren’t trapped in endless horizontal scroll. */
  const [showAllDates, setShowAllDates] = useState(false);

  const [confirmation, setConfirmation] = useState<{
    ref: string;
    isFree: boolean;
    scheduled: boolean;
    funding: string;
  } | null>(null);

  const [accountId, setAccountId] = useState<string | null>(null);
  const [balances, setBalances] = useState<{ minutes: number; creditCents: number } | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);

  // add-student form
  const [newName, setNewName] = useState("");
  const [newGrade, setNewGrade] = useState("9");
  const [newTz, setNewTz] = useState("America/Chicago");

  const selectedStudents = students.filter((s) => studentIds.includes(s.id));
  const student = selectedStudents[0] ?? null;
  const studentTz = student?.timezone || browserTimezone();
  const joiningNames = selectedStudents.map((s) => firstNameOf(s.full_name)).filter(Boolean);
  const joiningLabel = formatChildNames(joiningNames, "Your child");
  const multiChild = selectedStudents.length >= 2;

  // Free trial is ONE PER ACCOUNT (not per student), so eligibility keys on the
  // signed-in account, not the selected student. Server remains authoritative.
  useEffect(() => {
    if (!supabase || !accountId) return;
    let active = true;
    supabase.rpc("account_has_used_free_trial", { p_account: accountId }).then(({ data }) => {
      if (active) setFreeTrialUsed(Boolean(data));
    });
    return () => {
      active = false;
    };
  }, [supabase, accountId]);

  // Load the signed-in account id + current balances (owner-scoped, server-derived).
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data?.user?.id ?? null;
      if (!active) return;
      setAccountId(uid);
      if (uid) {
        const { data: bal } = await supabase.rpc("get_customer_balances", { p_account: uid });
        if (active && bal) {
          setBalances({ minutes: bal.package_minutes ?? 0, creditCents: bal.dollar_credit_cents ?? 0 });
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [supabase]);

  // Recompute the authoritative funding breakdown whenever the paid session
  // changes. This is display-only; book_session recomputes under locks.
  useEffect(() => {
    if (!supabase || !accountId || isFreeTrial) return;
    let active = true;
    supabase
      .rpc("booking_quote", { p_account: accountId, p_duration: duration, p_is_free_trial: false })
      .then(({ data, error: qErr }) => {
        if (!active) return;
        if (qErr) {
          setQuote(null);
          setError(friendlyError(qErr.message));
          return;
        }
        if (data) setQuote(data as Quote);
      });
    return () => {
      active = false;
    };
  }, [supabase, accountId, duration, isFreeTrial]);

  async function addStudent() {
    if (!supabase || submittingRef.current) return;
    setError(null);
    if (!newName.trim()) {
      setError("Enter the child's name.");
      return;
    }
    submittingRef.current = true;
    setBusy(true);
    try {
      const { data, error: e } = await supabase
        .from("students")
        .insert({ full_name: newName.trim(), grade_level: newGrade, timezone: newTz })
        .select("id, full_name, grade_level, timezone")
        .single();
      if (e) {
        setError(friendlyError(e.message));
        return;
      }
      setStudents((prev) => [...prev, data as StudentRow]);
      setStudentIds((prev) => {
        if (wouldExceedChildLimit(prev, data.id)) return prev;
        return uniqueStudentIds([...prev, data.id]);
      });
      setChildLimitMessage(null);
      setNewName("");
    } finally {
      setBusy(false);
      submittingRef.current = false;
    }
  }

  async function loadSlots(dur: StudyHallDuration) {
    if (!supabase) return;
    setSlotsLoading(true);
    setSlots([]);
    setSelectedSlot(null);
    setSelectedDayKey(null);
    setShowAllDates(false);
    const from = new Date(Date.now() + MIN_BOOKING_NOTICE_MINUTES * 60000).toISOString();
    const to = new Date(Date.now() + BOOKING_HORIZON_DAYS * 86400000).toISOString();
    const { data, error: e } = await supabase.rpc("get_available_slots", {
      p_subject_id: null,
      p_duration: dur,
      p_from: from,
      p_to: to,
    });
    setSlotsLoading(false);
    if (e) {
      setError(friendlyError(e.message));
      return;
    }
    setSlots((data ?? []).map((r: { slot_start: string }) => r.slot_start));
  }

  function toggleChild(id: string) {
    setError(null);
    if (studentIds.includes(id)) {
      if (studentIds.length === 1) return;
      setStudentIds(studentIds.filter((x) => x !== id));
      setChildLimitMessage(null);
      return;
    }
    if (wouldExceedChildLimit(studentIds, id)) {
      setChildLimitMessage("Up to 3 children can join the same Study Hall.");
      return;
    }
    setStudentIds([...studentIds, id]);
    setChildLimitMessage(null);
  }

  async function submitBooking() {
    if (!supabase || !selectedSlot || !studentIds.length || submittingRef.current) return;
    submittingRef.current = true;
    setBusy(true);
    setError(null);
    track(isFreeTrial ? ANALYTICS_EVENTS.freeTrialBookingStarted : ANALYTICS_EVENTS.paidBookingStarted, {
      duration,
    });
    let res: Response;
    try {
      res = await fetch("/api/checkout/booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: studentIds[0],
          studentIds,
          subjectId: null,
          otherSubject: null,
          note: note.trim() || null,
          duration,
          startISO: selectedSlot,
          isFreeTrial,
        }),
      });
    } catch {
      setBusy(false);
      submittingRef.current = false;
      setError("Something went wrong. Please try again.");
      return;
    }
    const payload = await res.json().catch(() => null);
    if (!res.ok) {
      setBusy(false);
      submittingRef.current = false;
      setError(friendlyError(payload?.error));
      return;
    }

    // Payment due → hand off to Stripe's hosted checkout.
    if (payload?.checkoutUrl) {
      window.location.assign(payload.checkoutUrl as string);
      return;
    }

    setBusy(false);
    submittingRef.current = false;
    let ref = "";
    if (payload?.bookingId) {
      const { data: b } = await supabase
        .from("bookings")
        .select("public_reference")
        .eq("id", payload.bookingId)
        .single();
      ref = b?.public_reference ?? "";
    }
    track(isFreeTrial ? ANALYTICS_EVENTS.freeTrialBooked : ANALYTICS_EVENTS.paidBookingCompleted, {
      funding: payload?.funding ?? "",
    });
    setConfirmation({
      ref,
      isFree: isFreeTrial,
      scheduled: true,
      funding: payload?.funding ?? "",
    });
    setStep("done");
  }

  const priceLabel = isFreeTrial ? "FREE" : formatUsd(SESSION_OPTIONS.find((o) => o.minutes === duration)!.priceUsd);
  const fullyPrepaid = !isFreeTrial && isFullyPrepaidQuote(quote);
  const prepaidRemaining =
    fullyPrepaid && balances
      ? remainingBalanceMinutes(balances.minutes, quote!.package_minutes_used)
      : null;

  const confirmCta = busy
    ? "Booking…"
    : isFreeTrial
      ? "Confirm booking"
      : fullyPrepaid
        ? "Confirm with prepaid hours"
        : "Confirm booking";

  const slotsByDay = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const iso of slots) {
      const key = formatDayHeading(iso, studentTz);
      const arr = map.get(key) ?? [];
      arr.push(iso);
      map.set(key, arr);
    }
    return Array.from(map.entries());
  }, [slots, studentTz]);

  const activeDayKey =
    selectedDayKey && slotsByDay.some(([k]) => k === selectedDayKey)
      ? selectedDayKey
      : (slotsByDay[0]?.[0] ?? null);

  const timesForSelectedDay = useMemo(() => {
    if (!activeDayKey) return [];
    return slotsByDay.find(([k]) => k === activeDayKey)?.[1] ?? [];
  }, [slotsByDay, activeDayKey]);

  const DATE_STRIP_INITIAL = 7;
  const visibleDays = showAllDates ? slotsByDay : slotsByDay.slice(0, DATE_STRIP_INITIAL);
  const hasMoreDates = slotsByDay.length > DATE_STRIP_INITIAL;

  // ---- rendering helpers ----
  const card =
    "rounded-2xl border border-ink-100 bg-white p-6 shadow-[0_1px_2px_rgba(19,19,17,0.04),0_10px_28px_-18px_rgba(19,19,17,0.16)] sm:p-8";
  const stepPill = (n: number, label: string, active: boolean, done: boolean) => (
    <div className="flex items-center gap-2">
      <span
        className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
          done ? "bg-gold-400 text-ink-900" : active ? "bg-ink-900 text-white" : "bg-ink-100 text-ink-400"
        }`}
      >
        {n}
      </span>
      <span className={`text-xs font-medium ${active ? "text-ink-900" : "text-ink-400"}`}>{label}</span>
    </div>
  );

  if (step === "done" && confirmation) {
    return (
      <div className={card}>
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gold-50 text-gold-700">
          <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor" className="h-6 w-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
          </svg>
        </div>
        <h2 className="mt-5 font-display text-2xl font-semibold text-ink-900">
          {confirmation.isFree || confirmation.funding === "package" || confirmation.funding === "credit"
            ? "Study Hall booked"
            : "Booking held"}
        </h2>
        <p className="mt-2 text-sm leading-6 text-ink-600">
          {confirmation.isFree
            ? "Your free 1-hour Study Hall is confirmed. We’ve matched an approved Guide."
            : confirmation.funding === "package"
              ? "Your session is confirmed using your prepaid hours. An approved Guide is matched."
              : confirmation.funding === "credit"
                ? "Your session is confirmed using your account credit. An approved Guide is matched."
                : "Your time is reserved and an approved Guide is matched. Complete payment to confirm this session."}
        </p>
        {selectedSlot ? (
          <dl className="mt-4 divide-y divide-ink-100 rounded-xl border border-ink-100 px-4 text-sm">
            <Row
              label="When"
              value={`${formatDayHeading(selectedSlot, studentTz)}, ${formatTime(selectedSlot, studentTz)} (${tzAbbreviation(selectedSlot, studentTz)})`}
            />
            <Row
              label="Duration"
              value={SESSION_OPTIONS.find((o) => o.minutes === duration)?.label ?? `${duration} minutes`}
            />
            <Row
              label={confirmation.isFree ? "Price" : fullyPrepaid ? "Payment" : "Due today"}
              value={
                confirmation.isFree
                  ? "Free"
                  : fullyPrepaid
                    ? "Covered by prepaid hours"
                    : quote
                      ? formatMoneyCents(quote.stripe_cents_due)
                      : priceLabel
              }
              highlight
            />
          </dl>
        ) : null}
        <p className="mt-3 text-sm text-ink-500">
          Reference: <span className="font-mono font-medium text-ink-800">{confirmation.ref}</span>
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button onClick={() => router.push("/dashboard/student")}>Go to dashboard</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2" aria-label="Booking steps">
        {stepPill(1, "Who", step === "student", ["duration", "time", "confirm"].includes(step))}
        {stepPill(2, "Session", step === "duration", ["time", "confirm"].includes(step))}
        {stepPill(3, "Date & time", step === "time", ["confirm"].includes(step))}
        {stepPill(4, "Confirm", step === "confirm", false)}
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      ) : null}

      {/* STEP 1: child */}
      {step === "student" ? (
        <div className={card}>
          <h2 className="font-display text-xl font-semibold text-ink-900">Who is joining Study Hall?</h2>
          {students.length === 1 ? (
            <p className="mt-3 text-sm text-ink-600">
              <span className="font-medium text-ink-900">{students[0].full_name}</span>
              {students[0].grade_level ? (
                <span className="text-ink-400"> · Grade {students[0].grade_level}</span>
              ) : null}
            </p>
          ) : students.length > 1 ? (
            <div className="mt-4 space-y-3">
              <p className="text-sm text-ink-500">Select up to {MAX_CHILDREN_PER_STUDY_HALL} children.</p>
              {students.map((s) => {
                const checked = studentIds.includes(s.id);
                return (
                  <label
                    key={s.id}
                    className={`flex cursor-pointer items-center justify-between rounded-xl border px-4 py-3 ${
                      checked ? "border-ink-900 bg-ink-50" : "border-ink-200 hover:border-ink-300"
                    }`}
                  >
                    <span>
                      <span className="font-medium text-ink-900">{s.full_name}</span>
                      <span className="ml-2 text-sm text-ink-400">
                        {s.grade_level ? `Grade ${s.grade_level}` : ""}
                      </span>
                    </span>
                    <input
                      type="checkbox"
                      name="joining"
                      checked={checked}
                      onChange={() => toggleChild(s.id)}
                      className="h-4 w-4"
                    />
                  </label>
                );
              })}
            </div>
          ) : (
            <p className="mt-2 text-sm text-ink-500">Add the child you&apos;re booking for to get started.</p>
          )}
          {childLimitMessage ? (
            <p className="mt-3 text-sm font-medium text-ink-800">{childLimitMessage}</p>
          ) : null}
          {multiChild ? (
            <p className="mt-3 text-sm text-ink-600">
              All children joining the Study Hall should remain visible on camera during the session.
            </p>
          ) : null}

          <details className="mt-5 rounded-xl border border-dashed border-ink-200 p-4" open={students.length === 0}>
            <summary className="cursor-pointer text-sm font-medium text-ink-700">Add a child</summary>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Child's name"
                className="rounded-lg border border-ink-200 px-3 py-2 text-sm sm:col-span-3"
              />
              <select
                value={newGrade}
                onChange={(e) => setNewGrade(e.target.value)}
                className="rounded-lg border border-ink-200 px-3 py-2 text-sm"
              >
                {GRADE_OPTIONS.map((g) => (
                  <option key={g} value={g}>
                    {g === "College" ? "College" : `Grade ${g}`}
                  </option>
                ))}
              </select>
              <select
                value={newTz}
                onChange={(e) => setNewTz(e.target.value)}
                className="rounded-lg border border-ink-200 px-3 py-2 text-sm sm:col-span-2"
              >
                {COMMON_TIMEZONES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <Button onClick={addStudent} disabled={busy} variant="outline" size="sm" className="mt-3">
              {busy ? "Adding..." : "Add child"}
            </Button>
          </details>

          <div className="mt-6">
            <Button onClick={() => setStep("duration")} disabled={!studentIds.length}>
              Continue
            </Button>
          </div>
        </div>
      ) : null}

      {/* STEP 2: duration + free trial */}
      {step === "duration" ? (
        <div className={card}>
          <h2 className="font-display text-xl font-semibold text-ink-900">Choose a session</h2>
          {balances && (balances.minutes > 0 || balances.creditCents > 0) ? (
            <p className="mt-2 rounded-lg border border-forest-200 bg-forest-50 px-3 py-2 text-xs text-ink-600">
              Your balance:{" "}
              {balances.minutes > 0 ? (
                <span className="font-medium text-ink-800">{formatDuration(balances.minutes)} of Prepaid Hours</span>
              ) : null}
              {balances.minutes > 0 && balances.creditCents > 0 ? " · " : null}
              {balances.creditCents > 0 ? (
                <span className="font-medium text-ink-800">{formatMoneyCents(balances.creditCents)} account credit</span>
              ) : null}
            </p>
          ) : null}
          <div className="mt-4 space-y-3">
            {freeTrialUsed === false ? (
              <button
                type="button"
                onClick={() => {
                  setDuration(FREE_TRIAL_MINUTES);
                  setIsFreeTrial(true);
                }}
                className={`flex w-full items-center justify-between rounded-xl border-2 px-5 py-4 text-left ${
                  isFreeTrial ? "border-gold-400 bg-gold-50" : "border-ink-200 hover:border-ink-300"
                }`}
              >
                <span>
                  <span className="block font-semibold text-ink-900">First 1-hour Study Hall — FREE</span>
                  <span className="text-sm text-ink-500">60 minutes · $0 · No credit card required.</span>
                </span>
                <span className="font-display text-2xl font-semibold text-gold-600">$0</span>
              </button>
            ) : null}

            {SESSION_OPTIONS.map((o) => {
              const covered = balances != null && balances.minutes >= o.minutes;
              const rightLabel = durationOptionPriceLabel(
                balances?.minutes ?? 0,
                o.minutes,
                formatUsd(o.priceUsd),
              );
              return (
                <button
                  key={o.minutes}
                  type="button"
                  onClick={() => {
                    setDuration(o.minutes as StudyHallDuration);
                    setIsFreeTrial(false);
                  }}
                  className={`flex w-full items-center justify-between gap-3 rounded-xl border px-5 py-4 text-left ${
                    !isFreeTrial && duration === o.minutes
                      ? "border-ink-900 bg-ink-50"
                      : "border-ink-200 hover:border-ink-300"
                  }`}
                >
                  <span className="font-medium text-ink-900">{o.label}</span>
                  <span
                    className={`text-right font-display font-semibold text-ink-900 ${
                      covered ? "text-sm sm:text-base" : "text-xl"
                    }`}
                  >
                    {rightLabel}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-6 flex gap-3">
            <Button variant="outline" onClick={() => setStep("student")}>
              Back
            </Button>
            <Button
              onClick={() => {
                loadSlots(duration);
                setStep("time");
              }}
            >
              Continue
            </Button>
          </div>
        </div>
      ) : null}

      {/* STEP 3: date & time — compact day strip + times (no nested page scroll trap) */}
      {step === "time" ? (
        <div className={card}>
          <h2 className="font-display text-xl font-semibold text-ink-900">Choose a date &amp; time</h2>
          <p className="mt-1 text-sm text-ink-500">
            Times shown in {tzAbbreviation(new Date().toISOString(), studentTz)}.
          </p>
          {slotsLoading ? (
            <p className="mt-6 text-sm text-ink-400">Finding available Study Hall times…</p>
          ) : slotsByDay.length === 0 ? (
            <p className="mt-6 rounded-lg border border-dashed border-ink-200 px-4 py-6 text-center text-sm text-ink-400">
              No available Study Hall times in the next few days. Please try another duration or check back soon.
            </p>
          ) : (
            <div className="mt-5 space-y-5">
              <div>
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">Date</p>
                  {visibleDays.length > 3 ? (
                    <p className="text-xs text-ink-400">Scroll sideways for more dates</p>
                  ) : null}
                </div>
                {/* Visible scrollbar so parents can discover horizontal scroll without trapping the page. */}
                <div
                  className="mt-2 flex gap-2 overflow-x-auto overscroll-x-contain pb-2 [scrollbar-gutter:stable]"
                  role="listbox"
                  aria-label="Available dates"
                >
                  {visibleDays.map(([day, isos]) => {
                    const active = day === activeDayKey;
                    return (
                      <button
                        key={day}
                        type="button"
                        role="option"
                        aria-selected={active}
                        onClick={() => {
                          setSelectedDayKey(day);
                          setSelectedSlot(null);
                        }}
                        className={`min-h-11 shrink-0 rounded-xl border px-3.5 py-2 text-left text-sm transition ${
                          active
                            ? "border-ink-900 bg-ink-900 text-white"
                            : "border-ink-200 bg-white text-ink-800 hover:border-ink-300"
                        }`}
                      >
                        <span className="block font-semibold">{day}</span>
                        <span className={`block text-xs ${active ? "text-white/70" : "text-ink-400"}`}>
                          {isos.length} {isos.length === 1 ? "time" : "times"}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {hasMoreDates ? (
                  <button
                    type="button"
                    onClick={() => setShowAllDates((v) => !v)}
                    className="mt-2 text-sm font-medium text-ink-700 underline-offset-4 hover:underline"
                  >
                    {showAllDates
                      ? "Show fewer dates"
                      : `Show more dates (${slotsByDay.length - DATE_STRIP_INITIAL} more)`}
                  </button>
                ) : null}
              </div>

              <div>
                <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">Time</p>
                <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {timesForSelectedDay.map((iso) => (
                    <button
                      key={iso}
                      type="button"
                      onClick={() => setSelectedSlot(iso)}
                      className={`min-h-11 rounded-lg border px-2 py-2 text-sm font-medium ${
                        selectedSlot === iso
                          ? "border-ink-900 bg-ink-900 text-white"
                          : "border-ink-200 text-ink-700 hover:border-ink-300"
                      }`}
                    >
                      {formatTime(iso, studentTz)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
          {/* Sticky actions so Continue stays reachable without hunting outside a scroll area */}
          <div className="sticky bottom-0 z-10 -mx-6 mt-6 border-t border-ink-100 bg-white/95 px-6 py-4 backdrop-blur sm:-mx-8 sm:px-8">
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={() => setStep("duration")}>
                Back
              </Button>
              <Button onClick={() => setStep("confirm")} disabled={!selectedSlot} className="min-w-[8.5rem]">
                Continue
              </Button>
            </div>
            {!selectedSlot && slotsByDay.length > 0 ? (
              <p className="mt-2 text-xs text-ink-400">Select a date and time, then tap Continue.</p>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* STEP 4: confirm */}
      {step === "confirm" ? (
        <div className={card}>
          <h2 className="font-display text-xl font-semibold text-ink-900">Confirm your Study Hall</h2>
          <p className="mt-2 text-sm leading-6 text-ink-600">
            Your Guide provides live supervision, accountability, and focus — plus gentle redirection when attention
            drifts. Guides do not tutor, teach lessons, or give homework answers.
          </p>
          <dl className="mt-4 divide-y divide-ink-100 text-sm">
            <Row
              label={selectedStudents.length > 1 ? "Children" : "Child"}
              value={
                selectedStudents.length > 1
                  ? joiningLabel
                  : `${student?.full_name ?? joiningLabel}${student?.grade_level ? ` · Grade ${student.grade_level}` : ""}`
              }
            />
            {selectedSlot ? (
              <Row
                label="When"
                value={`${formatDayHeading(selectedSlot, studentTz)}, ${formatTime(selectedSlot, studentTz)} (${tzAbbreviation(selectedSlot, studentTz)})`}
              />
            ) : null}
            <Row label="Duration" value={SESSION_OPTIONS.find((o) => o.minutes === duration)?.label ?? `${duration} minutes`} />
            {isFreeTrial ? <Row label="Price" value={priceLabel} highlight /> : null}
            {!isFreeTrial && !quote ? <Row label="Price" value={priceLabel} /> : null}
            {!isFreeTrial && fullyPrepaid && quote ? (
              <>
                <Row label="Payment" value="Covered by prepaid balance" highlight />
                <Row label="Prepaid Hours" value={`−${formatDuration(quote.package_minutes_used)}`} />
                {prepaidRemaining != null ? (
                  <Row label="Hours after booking" value={formatDuration(prepaidRemaining)} />
                ) : null}
                <Row label="Due today" value={formatMoneyCents(0)} highlight />
              </>
            ) : null}
            {!isFreeTrial && !fullyPrepaid && quote ? (
              <>
                <Row label="Price" value={priceLabel} />
                {quote.package_minutes_used > 0 ? (
                  <Row label="Prepaid Hours" value={`−${formatDuration(quote.package_minutes_used)}`} />
                ) : null}
                {quote.credit_cents_used > 0 ? (
                  <Row label="Account credit" value={`−${formatMoneyCents(quote.credit_cents_used)}`} />
                ) : null}
                <Row
                  label="Due today"
                  value={formatMoneyCents(quote.stripe_cents_due)}
                  highlight={quote.stripe_cents_due === 0}
                />
              </>
            ) : null}
          </dl>
          {multiChild ? (
            <p className="mt-3 text-sm text-ink-600">
              All children joining the Study Hall should remain visible on camera during the session.
            </p>
          ) : null}
          <div className="mt-4">
            <label className="text-sm font-medium text-ink-800">
              Anything we should know? <span className="text-ink-400">(optional)</span>
            </label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Prefers a quiet start, has a test tomorrow"
              className="mt-1.5 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-ink-400">Only shared with your matched Guide. Never shown publicly.</p>
          </div>
          {!isFreeTrial ? (
            <p className="mt-4 rounded-lg border border-ink-200 bg-ink-50 p-3 text-xs text-ink-500">
              {fullyPrepaid
                ? "No payment required. Your card will not be charged."
                : quote && quote.stripe_cents_due === 0
                  ? "This session is fully covered by your account credit — no payment required."
                  : balances && balances.minutes > 0 && !prepaidCoversDuration(balances.minutes, duration)
                    ? `Your prepaid balance (${formatDuration(balances.minutes)}) doesn’t cover this full ${formatDuration(duration)} session, so the cash price applies. Prepaid hours are used only when they fully cover the session. You’ll be taken to secure checkout for the amount due.`
                    : "You'll be taken to secure checkout to pay the amount due. Your slot is held for 15 minutes."}
            </p>
          ) : null}
          <div className="mt-6 flex gap-3">
            <Button variant="outline" onClick={() => setStep("time")}>
              Back
            </Button>
            <Button onClick={submitBooking} disabled={busy || !selectedSlot}>
              {confirmCta}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <dt className="text-ink-500">{label}</dt>
      <dd className={`text-right font-medium ${highlight ? "text-gold-600" : "text-ink-900"}`}>{value}</dd>
    </div>
  );
}
