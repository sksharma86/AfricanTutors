"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { BOOKING_STATUS_LABEL, type BookingStatus } from "@/lib/booking-config";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatDayHeading, formatTime } from "@/lib/timezone";

export interface AdminSubject {
  id: string;
  name: string;
  category: string;
  is_active: boolean;
}
export interface AdminTutor {
  profile_id: string;
  display_name: string | null;
}
export interface AdminTutorSubject {
  tutor_id: string;
  subject_id: string;
}
export interface AdminBooking {
  id: string;
  public_reference: string;
  subject_name: string | null;
  other_subject_text: string | null;
  student_first_name: string | null;
  tutor_display_name: string | null;
  scheduled_start: string | null;
  duration_minutes: number | null;
  status: BookingStatus;
  is_free_trial: boolean;
  price_cents: number;
  payment_status: string;
  subject_id: string | null;
}

const BOOKING_FILTERS = [
  "all",
  "pending",
  "confirmed",
  "awaiting_payment",
  "free_trial",
  "other_requests",
  "completed",
  "cancelled",
  "no_show",
  "expired",
] as const;

const CATEGORIES = ["math", "science", "english_writing", "test_prep", "college", "other"];

export function AdminConsole({
  subjects: initialSubjects,
  tutors,
  tutorSubjects: initialTS,
  bookings: initialBookings,
}: {
  subjects: AdminSubject[];
  tutors: AdminTutor[];
  tutorSubjects: AdminTutorSubject[];
  bookings: AdminBooking[];
}) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [subjects, setSubjects] = useState(initialSubjects);
  const [ts, setTs] = useState(initialTS);
  const [bookings, setBookings] = useState(initialBookings);
  const [error, setError] = useState<string | null>(null);

  const [bookingFilter, setBookingFilter] = useState<string>("all");
  const [newSubject, setNewSubject] = useState("");
  const [newCategory, setNewCategory] = useState("math");
  const [assignTutor, setAssignTutor] = useState(tutors[0]?.profile_id ?? "");
  const [assignSubject, setAssignSubject] = useState(initialSubjects[0]?.id ?? "");

  async function addSubject() {
    if (!supabase || !newSubject.trim()) return;
    setError(null);
    const { data, error: e } = await supabase
      .from("subjects")
      .insert({ name: newSubject.trim(), category: newCategory })
      .select("id, name, category, is_active")
      .single();
    if (e) {
      setError(e.message);
      return;
    }
    setSubjects((p) => [...p, data as AdminSubject]);
    setNewSubject("");
  }

  async function toggleSubject(s: AdminSubject) {
    if (!supabase) return;
    const { error: e } = await supabase.from("subjects").update({ is_active: !s.is_active }).eq("id", s.id);
    if (e) {
      setError(e.message);
      return;
    }
    setSubjects((p) => p.map((x) => (x.id === s.id ? { ...x, is_active: !x.is_active } : x)));
  }

  async function assign() {
    if (!supabase || !assignTutor || !assignSubject) return;
    setError(null);
    const { error: e } = await supabase.from("tutor_subjects").insert({ tutor_id: assignTutor, subject_id: assignSubject });
    if (e) {
      setError(e.message.includes("duplicate") ? "Already assigned." : e.message);
      return;
    }
    setTs((p) => [...p, { tutor_id: assignTutor, subject_id: assignSubject }]);
  }

  async function unassign(tutor_id: string, subject_id: string) {
    if (!supabase) return;
    const { error: e } = await supabase.from("tutor_subjects").delete().eq("tutor_id", tutor_id).eq("subject_id", subject_id);
    if (e) {
      setError(e.message);
      return;
    }
    setTs((p) => p.filter((x) => !(x.tutor_id === tutor_id && x.subject_id === subject_id)));
  }

  async function bookingOp(id: string, action: "complete" | "no_show" | "release" | "reassign") {
    setError(null);
    const payload: Record<string, unknown> = { bookingId: id, action };
    if (action === "release") {
      const comp = window.prompt("Courtesy account credit in dollars (0 for none):", "0");
      if (comp === null) return;
      payload.compCreditCents = Math.max(0, Math.round(parseFloat(comp) * 100) || 0);
      payload.reason = "admin/tutor cancellation";
    }
    if (action === "reassign") {
      const b = bookings.find((x) => x.id === id);
      const eligible = tutors.filter((t) => (b?.subject_id ? ts.some((x) => x.tutor_id === t.profile_id && x.subject_id === b.subject_id) : true));
      if (eligible.length === 0) { setError("No eligible Guides for this subject."); return; }
      const list = eligible.map((t, i) => `${i + 1}) ${t.display_name ?? t.profile_id.slice(0, 8)}`).join("\n");
      const pick = window.prompt(`Reassign to which Guide?\n${list}`);
      if (pick === null) return;
      const idx = parseInt(pick, 10) - 1;
      if (!(idx >= 0 && idx < eligible.length)) { setError("Invalid choice."); return; }
      payload.newTutorId = eligible[idx].profile_id;
      payload.reason = "tutor reassignment";
    }
    const res = await fetch("/api/admin/booking", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = await res.json().catch(() => null);
    if (!res.ok) { setError(data?.error ?? "Operation failed."); return; }
    const newStatus: BookingStatus | null =
      action === "complete" ? "completed" : action === "no_show" ? "no_show" : action === "release" ? "cancelled" : null;
    setBookings((p) => p.map((b) => (b.id === id ? { ...b, status: (newStatus ?? b.status) as BookingStatus } : b)));
  }

  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      switch (bookingFilter) {
        case "all":
          return true;
        case "awaiting_payment":
          return b.payment_status === "awaiting_payment" && !b.is_free_trial;
        case "free_trial":
          return b.is_free_trial;
        case "other_requests":
          return b.subject_id === null && b.status === "pending";
        default:
          return b.status === bookingFilter;
      }
    });
  }, [bookings, bookingFilter]);

  const subjectName = (id: string) => subjects.find((s) => s.id === id)?.name ?? id;
  const workload = useMemo(() => {
    const m = new Map<string, number>();
    for (const b of bookings) {
      if (b.tutor_display_name && (b.status === "confirmed" || b.status === "pending")) {
        m.set(b.tutor_display_name, (m.get(b.tutor_display_name) ?? 0) + 1);
      }
    }
    return m;
  }, [bookings]);

  return (
    <div className="space-y-10">
      {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      {/* Bookings oversight */}
      <section className="rounded-2xl border border-ink-100 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-display text-lg font-semibold text-ink-900">Bookings</h3>
          <select
            value={bookingFilter}
            onChange={(e) => setBookingFilter(e.target.value)}
            className="rounded-lg border border-ink-200 px-3 py-1.5 text-sm"
          >
            {BOOKING_FILTERS.map((f) => (
              <option key={f} value={f}>
                {f === "all"
                  ? "All bookings"
                  : f === "awaiting_payment"
                    ? "Awaiting payment"
                    : f === "free_trial"
                      ? "Free trials"
                      : f === "other_requests"
                        ? "Other requests"
                        : f.charAt(0).toUpperCase() + f.slice(1)}
              </option>
            ))}
          </select>
        </div>
        <p className="mt-1 text-sm text-ink-500">
          {filteredBookings.length} shown · {bookings.length} total
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-ink-400">
              <tr>
                <th className="py-2 pr-4">Student</th>
                <th className="py-2 pr-4">Subject</th>
                <th className="py-2 pr-4">Guide</th>
                <th className="py-2 pr-4">When (UTC)</th>
                <th className="py-2 pr-4">Len</th>
                <th className="py-2 pr-4">Type</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {filteredBookings.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-ink-400">
                    No bookings match this filter.
                  </td>
                </tr>
              ) : (
                filteredBookings.map((b) => (
                  <tr key={b.id}>
                    <td className="py-2.5 pr-4 text-ink-800">{b.student_first_name ?? "—"}</td>
                    <td className="py-2.5 pr-4 text-ink-800">
                      {b.subject_name ?? (b.other_subject_text ? `Other — ${b.other_subject_text}` : "—")}
                    </td>
                    <td className="py-2.5 pr-4 text-ink-600">{b.tutor_display_name ?? "unassigned"}</td>
                    <td className="py-2.5 pr-4 text-ink-600">
                      {b.scheduled_start
                        ? `${formatDayHeading(b.scheduled_start, "UTC")} ${formatTime(b.scheduled_start, "UTC")}`
                        : "—"}
                    </td>
                    <td className="py-2.5 pr-4 text-ink-600">{b.duration_minutes ?? "—"}</td>
                    <td className="py-2.5 pr-4">
                      {b.is_free_trial ? (
                        <span className="font-medium text-gold-600">Free</span>
                      ) : (
                        <span className="text-ink-600">${(b.price_cents / 100).toFixed(0)}</span>
                      )}
                    </td>
                    <td className="py-2.5 pr-4 text-ink-600">{BOOKING_STATUS_LABEL[b.status]}</td>
                    <td className="py-2.5">
                      {b.status === "confirmed" || b.status === "pending" ? (
                        <div className="flex flex-wrap gap-2 text-xs">
                          <button onClick={() => bookingOp(b.id, "complete")} className="font-medium text-gold-700 hover:underline">Complete</button>
                          <button onClick={() => bookingOp(b.id, "no_show")} className="font-medium text-ink-600 hover:underline">No-show</button>
                          {b.subject_id && b.scheduled_start ? (
                            <button onClick={() => bookingOp(b.id, "reassign")} className="font-medium text-ink-600 hover:underline">Reassign</button>
                          ) : null}
                          <button onClick={() => bookingOp(b.id, "release")} className="font-medium text-red-600 hover:underline">Release</button>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Subject catalog */}
      <section className="rounded-2xl border border-ink-100 bg-white p-6">
        <h3 className="font-display text-lg font-semibold text-ink-900">Subject catalog</h3>
        <div className="mt-4 flex flex-wrap gap-2">
          {subjects.map((s) => (
            <button
              key={s.id}
              onClick={() => toggleSubject(s)}
              className={`rounded-full border px-3 py-1 text-sm ${
                s.is_active ? "border-gold-200 bg-gold-50 text-gold-700" : "border-ink-200 bg-ink-50 text-ink-400 line-through"
              }`}
              title={s.is_active ? "Click to disable" : "Click to enable"}
            >
              {s.name}
            </button>
          ))}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <input
            value={newSubject}
            onChange={(e) => setNewSubject(e.target.value)}
            placeholder="New subject name"
            className="rounded-lg border border-ink-200 px-3 py-2 text-sm sm:col-span-2"
          />
          <select value={newCategory} onChange={(e) => setNewCategory(e.target.value)} className="rounded-lg border border-ink-200 px-3 py-2 text-sm">
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <Button onClick={addSubject} variant="outline" size="sm">
            Add subject
          </Button>
        </div>
      </section>

      {/* Tutor ↔ subject assignment */}
      <section className="rounded-2xl border border-ink-100 bg-white p-6">
        <h3 className="font-display text-lg font-semibold text-ink-900">Guide subject approvals</h3>
        <p className="mt-1 text-sm text-ink-500">Only admins control which subjects each Guide may teach.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <select value={assignTutor} onChange={(e) => setAssignTutor(e.target.value)} className="rounded-lg border border-ink-200 px-3 py-2 text-sm">
            {tutors.map((t) => (
              <option key={t.profile_id} value={t.profile_id}>
                {t.display_name ?? t.profile_id.slice(0, 8)} {workload.get(t.display_name ?? "") ? `(${workload.get(t.display_name ?? "")} upcoming)` : ""}
              </option>
            ))}
          </select>
          <select value={assignSubject} onChange={(e) => setAssignSubject(e.target.value)} className="rounded-lg border border-ink-200 px-3 py-2 text-sm">
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <Button onClick={assign} variant="outline" size="sm">
            Approve Guide for subject
          </Button>
        </div>

        <div className="mt-5 space-y-3">
          {tutors.map((t) => {
            const mine = ts.filter((x) => x.tutor_id === t.profile_id);
            return (
              <div key={t.profile_id} className="rounded-xl border border-ink-100 p-3">
                <p className="text-sm font-medium text-ink-900">{t.display_name ?? t.profile_id.slice(0, 8)}</p>
                {mine.length === 0 ? (
                  <p className="mt-1 text-xs text-ink-400">No subjects assigned.</p>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {mine.map((x) => (
                      <span key={x.subject_id} className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 px-2.5 py-0.5 text-xs text-ink-700">
                        {subjectName(x.subject_id)}
                        <button onClick={() => unassign(x.tutor_id, x.subject_id)} className="text-red-500 hover:text-red-700" aria-label="Remove">
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
