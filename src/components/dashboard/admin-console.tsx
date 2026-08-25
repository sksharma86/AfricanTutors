"use client";

import { useMemo, useState } from "react";

import { BOOKING_STATUS_LABEL, type BookingStatus } from "@/lib/booking-config";
import { formatDayHeading, formatTime } from "@/lib/timezone";

export interface AdminTutor {
  profile_id: string;
  display_name: string | null;
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
  /** Legacy tutoring metadata — not used for Study Hall Guide matching. */
  subject_id: string | null;
}

interface ReassignCandidate {
  profile_id: string;
  display_name: string | null;
  upcoming_load: number;
}

const BOOKING_FILTERS = [
  "all",
  "pending",
  "confirmed",
  "awaiting_payment",
  "free_trial",
  "completed",
  "cancelled",
  "no_show",
  "expired",
] as const;

export function AdminConsole({
  bookings: initialBookings,
}: {
  /** @deprecated Eligibility is fetched per booking; prop kept optional for callers. */
  tutors?: AdminTutor[];
  bookings: AdminBooking[];
}) {
  const [bookings, setBookings] = useState(initialBookings);
  const [error, setError] = useState<string | null>(null);
  const [bookingFilter, setBookingFilter] = useState<string>("all");

  async function bookingOp(id: string, action: "complete" | "no_show" | "release" | "reassign") {
    setError(null);
    const payload: Record<string, unknown> = { bookingId: id, action };
    let pickedGuideName: string | null = null;

    if (action === "release") {
      const comp = window.prompt("Courtesy account credit in dollars (0 for none):", "0");
      if (comp === null) return;
      payload.compCreditCents = Math.max(0, Math.round(parseFloat(comp) * 100) || 0);
      payload.reason = "admin/Guide cancellation";
    }

    if (action === "reassign") {
      // Same eligibility as automatic reassignment: approved + continuous
      // availability for the full interval + no overlap + not current Guide.
      const candRes = await fetch(`/api/admin/reassignment-candidates?bookingId=${encodeURIComponent(id)}`);
      const candData = await candRes.json().catch(() => null);
      if (!candRes.ok) {
        setError(candData?.error ?? "Unable to load eligible Guides.");
        return;
      }
      const candidates = (candData?.candidates ?? []) as ReassignCandidate[];
      if (candidates.length === 0) {
        setError("No eligible Guides are continuously available for this entire Study Hall.");
        return;
      }
      const list = candidates
        .map((t, i) => `${i + 1}) ${t.display_name ?? t.profile_id.slice(0, 8)}`)
        .join("\n");
      const pick = window.prompt(
        `Reassign to which eligible Guide?\n(Only Guides continuously available for the full session)\n${list}`,
      );
      if (pick === null) return;
      const idx = parseInt(pick, 10) - 1;
      if (!(idx >= 0 && idx < candidates.length)) {
        setError("Invalid choice.");
        return;
      }
      payload.newTutorId = candidates[idx].profile_id;
      pickedGuideName = candidates[idx].display_name;
      payload.reason = "Guide reassignment";
    }

    const res = await fetch("/api/admin/booking", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setError(data?.error ?? "Operation failed.");
      return;
    }

    const newStatus: BookingStatus | null =
      action === "complete" ? "completed" : action === "no_show" ? "no_show" : action === "release" ? "cancelled" : null;

    setBookings((p) =>
      p.map((b) => {
        if (b.id !== id) return b;
        return {
          ...b,
          status: (newStatus ?? b.status) as BookingStatus,
          tutor_display_name: action === "reassign" && pickedGuideName ? pickedGuideName : b.tutor_display_name,
        };
      }),
    );
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
        default:
          return b.status === bookingFilter;
      }
    });
  }, [bookings, bookingFilter]);

  return (
    <div className="space-y-10">
      {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      <section className="rounded-2xl border border-ink-100 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-display text-lg font-semibold text-ink-900">Sessions</h3>
          <select
            value={bookingFilter}
            onChange={(e) => setBookingFilter(e.target.value)}
            className="rounded-lg border border-ink-200 px-3 py-1.5 text-sm"
          >
            {BOOKING_FILTERS.map((f) => (
              <option key={f} value={f}>
                {f === "all"
                  ? "All sessions"
                  : f === "awaiting_payment"
                    ? "Awaiting payment"
                    : f === "free_trial"
                      ? "Free sessions"
                      : f.charAt(0).toUpperCase() + f.slice(1)}
              </option>
            ))}
          </select>
        </div>
        <p className="mt-1 text-sm text-ink-500">
          {filteredBookings.length} shown · {bookings.length} total · manual reassignment lists only Guides continuously
          available for the full session
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-ink-400">
              <tr>
                <th className="py-2 pr-4">Child</th>
                <th className="py-2 pr-4">Session</th>
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
                    No sessions match this filter.
                  </td>
                </tr>
              ) : (
                filteredBookings.map((b) => (
                  <tr key={b.id}>
                    <td className="py-2.5 pr-4 text-ink-800">{b.student_first_name ?? "—"}</td>
                    <td className="py-2.5 pr-4 text-ink-800">Study Hall</td>
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
                          <button onClick={() => bookingOp(b.id, "complete")} className="font-medium text-gold-700 hover:underline">
                            Complete
                          </button>
                          <button onClick={() => bookingOp(b.id, "no_show")} className="font-medium text-ink-600 hover:underline">
                            No-show
                          </button>
                          {b.scheduled_start ? (
                            <button onClick={() => bookingOp(b.id, "reassign")} className="font-medium text-ink-600 hover:underline">
                              Reassign
                            </button>
                          ) : null}
                          <button onClick={() => bookingOp(b.id, "release")} className="font-medium text-red-600 hover:underline">
                            Release
                          </button>
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
    </div>
  );
}
