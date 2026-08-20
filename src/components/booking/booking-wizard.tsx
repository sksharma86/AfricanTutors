"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { BOOKING_HORIZON_DAYS, MIN_BOOKING_NOTICE_MINUTES } from "@/lib/booking-config";
import { SESSION_OPTIONS, formatUsd } from "@/lib/pricing";
import { formatDuration, formatMoneyCents } from "@/lib/format.mjs";
import { COMMON_TIMEZONES, browserTimezone, formatDayHeading, formatTime, tzAbbreviation } from "@/lib/timezone";

export interface StudentRow {
  id: string;
  full_name: string;
  grade_level: string | null;
  timezone: string;
}
export interface SubjectRow {
  id: string;
  name: string;
  category: string;
}

const CATEGORY_LABEL: Record<string, string> = {
  math: "Math",
  science: "Science",
  english_writing: "English / Writing",
  test_prep: "Test Prep",
  college: "College Subjects",
  other: "Other",
};

const GRADE_OPTIONS = ["6", "7", "8", "9", "10", "11", "12", "College"];

// Only surface parent-friendly messages; never leak DB/SQL/security internals.
const TECHNICAL_ERROR = /permission denied|violates|constraint|null value|relation|column|function|syntax|jwt|supabase|fetch failed|network|exclusion|duplicate key|rls|policy/i;
function friendlyError(message?: string | null): string {
  if (!message || TECHNICAL_ERROR.test(message)) {
    return "Something went wrong. Please try again.";
  }
  return message;
}

type Step = "student" | "subject" | "duration" | "time" | "confirm" | "done";

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
  subjects,
}: {
  students: StudentRow[];
  subjects: SubjectRow[];
}) {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [students, setStudents] = useState<StudentRow[]>(initialStudents);
  const [step, setStep] = useState<Step>(initialStudents.length ? "student" : "student");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [studentId, setStudentId] = useState<string>(initialStudents[0]?.id ?? "");
  const [freeTrialUsed, setFreeTrialUsed] = useState<boolean | null>(null);

  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [otherText, setOtherText] = useState("");
  const [note, setNote] = useState("");

  const [duration, setDuration] = useState<30 | 60>(30);
  const [isFreeTrial, setIsFreeTrial] = useState(false);

  const [slots, setSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

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

  const student = students.find((s) => s.id === studentId) ?? null;
  const studentTz = student?.timezone || browserTimezone();

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
    if (!supabase || !accountId || isFreeTrial || subjectId === null) return;
    let active = true;
    supabase
      .rpc("booking_quote", { p_account: accountId, p_duration: duration, p_is_free_trial: false })
      .then(({ data }) => {
        if (active && data) setQuote(data as Quote);
      });
    return () => {
      active = false;
    };
  }, [supabase, accountId, duration, isFreeTrial, subjectId]);

  const grouped = useMemo(() => {
    const groups: Record<string, SubjectRow[]> = {};
    for (const s of subjects) (groups[s.category] ??= []).push(s);
    return groups;
  }, [subjects]);

  async function addStudent() {
    if (!supabase) return;
    setError(null);
    if (!newName.trim()) {
      setError("Enter the student's name.");
      return;
    }
    setBusy(true);
    const { data, error: e } = await supabase
      .from("students")
      .insert({ full_name: newName.trim(), grade_level: newGrade, timezone: newTz })
      .select("id, full_name, grade_level, timezone")
      .single();
    setBusy(false);
    if (e) {
      setError(friendlyError(e.message));
      return;
    }
    setStudents((prev) => [...prev, data as StudentRow]);
    setStudentId(data.id);
    setNewName("");
  }

  async function loadSlots(dur: 30 | 60, subj: string) {
    if (!supabase) return;
    setSlotsLoading(true);
    setSlots([]);
    setSelectedSlot(null);
    const from = new Date(Date.now() + MIN_BOOKING_NOTICE_MINUTES * 60000).toISOString();
    const to = new Date(Date.now() + BOOKING_HORIZON_DAYS * 86400000).toISOString();
    const { data, error: e } = await supabase.rpc("get_available_slots", {
      p_subject_id: subj,
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

  async function submitBooking() {
    if (!supabase) return;
    setBusy(true);
    setError(null);
    let res: Response;
    try {
      res = await fetch("/api/checkout/booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          subjectId,
          otherSubject: subjectId ? null : otherText.trim(),
          note: note.trim() || null,
          duration,
          startISO: subjectId ? selectedSlot : null,
          isFreeTrial,
        }),
      });
    } catch {
      setBusy(false);
      setError("Something went wrong. Please try again.");
      return;
    }
    const payload = await res.json().catch(() => null);
    if (!res.ok) {
      setBusy(false);
      setError(friendlyError(payload?.error));
      return;
    }

    // Payment due → hand off to Stripe's hosted checkout.
    if (payload?.checkoutUrl) {
      window.location.assign(payload.checkoutUrl as string);
      return;
    }

    setBusy(false);
    let ref = "";
    if (payload?.bookingId) {
      const { data: b } = await supabase
        .from("bookings")
        .select("public_reference")
        .eq("id", payload.bookingId)
        .single();
      ref = b?.public_reference ?? "";
    }
    setConfirmation({
      ref,
      isFree: isFreeTrial,
      scheduled: Boolean(subjectId),
      funding: payload?.funding ?? "",
    });
    setStep("done");
  }

  const priceLabel = isFreeTrial ? "FREE" : formatUsd(SESSION_OPTIONS.find((o) => o.minutes === duration)!.priceUsd);

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
          {confirmation.scheduled
            ? confirmation.isFree || confirmation.funding === "package" || confirmation.funding === "credit"
              ? "Session confirmed!"
              : "Booking held"
            : "Request received!"}
        </h2>
        <p className="mt-2 text-sm leading-6 text-ink-600">
          {confirmation.scheduled
            ? confirmation.isFree
              ? "Your free 30-minute introductory session is confirmed. We've matched an approved African Tutors tutor."
              : confirmation.funding === "package"
                ? "Your session is confirmed using your package minutes. An approved African Tutors tutor is matched."
                : confirmation.funding === "credit"
                  ? "Your session is confirmed using your account credit. An approved African Tutors tutor is matched."
                  : "Your time is reserved and an approved African Tutors tutor is matched. Complete payment to confirm this session."
            : "Thanks — our team will review your request and follow up to arrange an approved tutor."}
        </p>
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
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        {stepPill(1, "Student", step === "student", ["subject", "duration", "time", "confirm"].includes(step))}
        {stepPill(2, "Subject", step === "subject", ["duration", "time", "confirm"].includes(step))}
        {stepPill(3, "Session", step === "duration", ["time", "confirm"].includes(step))}
        {stepPill(4, "Time", step === "time", ["confirm"].includes(step))}
        {stepPill(5, "Confirm", step === "confirm", false)}
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      ) : null}

      {/* STEP 1: student */}
      {step === "student" ? (
        <div className={card}>
          <h2 className="font-display text-xl font-semibold text-ink-900">Who needs tutoring?</h2>
          {students.length > 0 ? (
            <div className="mt-4 space-y-3">
              {students.map((s) => (
                <label
                  key={s.id}
                  className={`flex cursor-pointer items-center justify-between rounded-xl border px-4 py-3 ${
                    studentId === s.id ? "border-ink-900 bg-ink-50" : "border-ink-200 hover:border-ink-300"
                  }`}
                >
                  <span>
                    <span className="font-medium text-ink-900">{s.full_name}</span>
                    <span className="ml-2 text-sm text-ink-400">
                      {s.grade_level ? `Grade ${s.grade_level}` : ""}
                    </span>
                  </span>
                  <input
                    type="radio"
                    name="student"
                    checked={studentId === s.id}
                    onChange={() => setStudentId(s.id)}
                    className="h-4 w-4"
                  />
                </label>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-ink-500">Add the student you&apos;re booking for to get started.</p>
          )}

          <details className="mt-5 rounded-xl border border-dashed border-ink-200 p-4" open={students.length === 0}>
            <summary className="cursor-pointer text-sm font-medium text-ink-700">Add a student</summary>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Student name"
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
              {busy ? "Adding..." : "Add student"}
            </Button>
          </details>

          <div className="mt-6">
            <Button onClick={() => setStep("subject")} disabled={!studentId}>
              Continue
            </Button>
          </div>
        </div>
      ) : null}

      {/* STEP 2: subject */}
      {step === "subject" ? (
        <div className={card}>
          <h2 className="font-display text-xl font-semibold text-ink-900">What subject?</h2>
          <div className="mt-4 space-y-5">
            {Object.entries(grouped).map(([cat, list]) => (
              <div key={cat}>
                <p className="text-xs font-semibold tracking-wide text-gold-700 uppercase">
                  {CATEGORY_LABEL[cat] ?? cat}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {list.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        setSubjectId(s.id);
                        setOtherText("");
                      }}
                      className={`rounded-full border px-4 py-1.5 text-sm ${
                        subjectId === s.id
                          ? "border-ink-900 bg-ink-900 text-white"
                          : "border-ink-200 text-ink-700 hover:border-ink-300"
                      }`}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <div>
              <p className="text-xs font-semibold tracking-wide text-gold-700 uppercase">Something else</p>
              <button
                type="button"
                onClick={() => setSubjectId(null)}
                className={`mt-2 rounded-full border px-4 py-1.5 text-sm ${
                  subjectId === null
                    ? "border-ink-900 bg-ink-900 text-white"
                    : "border-ink-200 text-ink-700 hover:border-ink-300"
                }`}
              >
                Other (describe your need)
              </button>
              {subjectId === null ? (
                <input
                  value={otherText}
                  onChange={(e) => setOtherText(e.target.value)}
                  placeholder="e.g. AP Statistics review"
                  className="mt-3 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm"
                />
              ) : null}
            </div>

            <div>
              <label className="text-sm font-medium text-ink-800">
                What do you need help with? <span className="text-ink-400">(optional)</span>
              </label>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Quadratic equations, chemistry test Friday, SAT math"
                className="mt-1.5 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm"
              />
              <p className="mt-1 text-xs text-ink-400">Only shared with your matched tutor. Never shown publicly.</p>
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <Button variant="outline" onClick={() => setStep("student")}>
              Back
            </Button>
            <Button
              onClick={() => setStep(subjectId === null ? "duration" : "duration")}
              disabled={subjectId === null && !otherText.trim()}
            >
              Continue
            </Button>
          </div>
        </div>
      ) : null}

      {/* STEP 3: duration + free trial */}
      {step === "duration" ? (
        <div className={card}>
          <h2 className="font-display text-xl font-semibold text-ink-900">Choose a session</h2>
          {balances && (balances.minutes > 0 || balances.creditCents > 0) ? (
            <p className="mt-2 rounded-lg border border-forest-200 bg-forest-50 px-3 py-2 text-xs text-ink-600">
              Your balance:{" "}
              {balances.minutes > 0 ? <span className="font-medium text-ink-800">{formatDuration(balances.minutes)} of tutoring</span> : null}
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
                  setDuration(30);
                  setIsFreeTrial(true);
                }}
                className={`flex w-full items-center justify-between rounded-xl border-2 px-5 py-4 text-left ${
                  isFreeTrial ? "border-gold-400 bg-gold-50" : "border-ink-200 hover:border-ink-300"
                }`}
              >
                <span>
                  <span className="block font-semibold text-ink-900">First 30 minutes — FREE</span>
                  <span className="text-sm text-ink-500">A real one-on-one session. No credit card required.</span>
                </span>
                <span className="font-display text-2xl font-semibold text-gold-600">$0</span>
              </button>
            ) : null}

            {SESSION_OPTIONS.map((o) => (
              <button
                key={o.minutes}
                type="button"
                onClick={() => {
                  setDuration(o.minutes as 30 | 60);
                  setIsFreeTrial(false);
                }}
                className={`flex w-full items-center justify-between rounded-xl border px-5 py-4 text-left ${
                  !isFreeTrial && duration === o.minutes
                    ? "border-ink-900 bg-ink-50"
                    : "border-ink-200 hover:border-ink-300"
                }`}
              >
                <span className="font-medium text-ink-900">{o.label}</span>
                <span className="font-display text-xl font-semibold text-ink-900">{formatUsd(o.priceUsd)}</span>
              </button>
            ))}
          </div>

          <div className="mt-6 flex gap-3">
            <Button variant="outline" onClick={() => setStep("subject")}>
              Back
            </Button>
            <Button
              onClick={() => {
                if (subjectId === null) {
                  setStep("confirm");
                } else {
                  loadSlots(duration, subjectId);
                  setStep("time");
                }
              }}
            >
              Continue
            </Button>
          </div>
        </div>
      ) : null}

      {/* STEP 4: time */}
      {step === "time" ? (
        <div className={card}>
          <h2 className="font-display text-xl font-semibold text-ink-900">Choose a time</h2>
          <p className="mt-1 text-sm text-ink-500">
            Times shown in {student?.full_name}&apos;s timezone ({tzAbbreviation(new Date().toISOString(), studentTz)}).
          </p>
          {slotsLoading ? (
            <p className="mt-6 text-sm text-ink-400">Finding available tutors…</p>
          ) : slotsByDay.length === 0 ? (
            <p className="mt-6 rounded-lg border border-dashed border-ink-200 px-4 py-6 text-center text-sm text-ink-400">
              No open times in the next {BOOKING_HORIZON_DAYS} days for this subject. Try a different subject or check
              back soon.
            </p>
          ) : (
            <div className="mt-5 max-h-96 space-y-5 overflow-y-auto pr-1">
              {slotsByDay.map(([day, isos]) => (
                <div key={day}>
                  <p className="text-sm font-semibold text-ink-800">{day}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {isos.map((iso) => (
                      <button
                        key={iso}
                        type="button"
                        onClick={() => setSelectedSlot(iso)}
                        className={`rounded-lg border px-3 py-1.5 text-sm ${
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
              ))}
            </div>
          )}
          <div className="mt-6 flex gap-3">
            <Button variant="outline" onClick={() => setStep("duration")}>
              Back
            </Button>
            <Button onClick={() => setStep("confirm")} disabled={!selectedSlot}>
              Continue
            </Button>
          </div>
        </div>
      ) : null}

      {/* STEP 5: confirm */}
      {step === "confirm" ? (
        <div className={card}>
          <h2 className="font-display text-xl font-semibold text-ink-900">Confirm your booking</h2>
          <dl className="mt-4 divide-y divide-ink-100 text-sm">
            <Row label="Student" value={`${student?.full_name}${student?.grade_level ? ` · Grade ${student.grade_level}` : ""}`} />
            <Row label="Subject" value={subjectId ? subjects.find((s) => s.id === subjectId)?.name ?? "" : `Other — ${otherText}`} />
            {note ? <Row label="Focus" value={note} /> : null}
            <Row label="Duration" value={`${duration} minutes`} />
            {subjectId && selectedSlot ? (
              <Row
                label="Time"
                value={`${formatDayHeading(selectedSlot, studentTz)}, ${formatTime(selectedSlot, studentTz)} (${tzAbbreviation(selectedSlot, studentTz)})`}
              />
            ) : (
              <Row label="Time" value="Our team will arrange a time with you" />
            )}
            <Row label="Session price" value={priceLabel} highlight={isFreeTrial} />
            {!isFreeTrial && subjectId && quote ? (
              <>
                {quote.package_minutes_used > 0 ? (
                  <Row label="Tutoring balance" value={`−${formatDuration(quote.package_minutes_used)}`} />
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
          {!isFreeTrial && subjectId ? (
            <p className="mt-4 rounded-lg border border-ink-200 bg-ink-50 p-3 text-xs text-ink-500">
              {quote && quote.package_minutes_used > 0 && quote.stripe_cents_due === 0
                ? "This session is covered by your tutoring balance — no payment required."
                : quote && quote.stripe_cents_due === 0
                  ? "This session is fully covered by your account credit — no payment required."
                  : "You'll be taken to secure checkout to pay the amount due. Your slot is held for 15 minutes."}
            </p>
          ) : null}
          <div className="mt-6 flex gap-3">
            <Button variant="outline" onClick={() => setStep(subjectId ? "time" : "duration")}>
              Back
            </Button>
            <Button onClick={submitBooking} disabled={busy}>
              {busy ? "Booking…" : subjectId ? "Confirm booking" : "Send request"}
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
