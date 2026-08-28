import "server-only";

import type { createSupabaseServerClient } from "@/lib/supabase/server";
import type { GuideBooking, GuideEarning } from "@/lib/guide-portal-types";

export type GuideAvailabilityBlock = { id: string; day_of_week: number; start_time: string; end_time: string };
export type GuideExceptionRow = { id: string; starts_at: string; ends_at: string; reason: string | null };

export type { GuideBooking, GuideEarning };

type SB = NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>;

export async function loadGuideWorkspace(supabase: SB, tutorId: string) {
  const [{ data: profile }, { data: bookingsRaw }, { data: avail }, { data: exc }, { data: earningsRaw }, { data: reqs }, reportsRes] =
    await Promise.all([
      supabase
        .from("tutor_profiles")
        .select("timezone, comp_rate_cents_per_hour, comp_currency, status")
        .eq("profile_id", tutorId)
        .maybeSingle(),
      supabase
        .from("bookings")
        .select(
          "id, subject_name, other_subject_text, student_first_name, student_first_names, child_count, student_grade, request_note, scheduled_start, scheduled_end, duration_minutes, status, is_free_trial",
        )
        .order("scheduled_start", { ascending: true, nullsFirst: false })
        .then((r) =>
          r.error && /student_first_names|child_count/i.test(r.error.message)
            ? supabase
                .from("bookings")
                .select(
                  "id, subject_name, other_subject_text, student_first_name, student_grade, request_note, scheduled_start, scheduled_end, duration_minutes, status, is_free_trial",
                )
                .order("scheduled_start", { ascending: true, nullsFirst: false })
            : r,
        ),
      supabase.from("tutor_availability").select("id, day_of_week, start_time, end_time"),
      supabase.from("tutor_availability_exceptions").select("id, starts_at, ends_at, reason"),
      supabase
        .from("tutor_earnings")
        .select("booking_id, amount_cents, status, earned_at, paid_at, currency")
        .order("earned_at", { ascending: false, nullsFirst: false }),
      supabase.from("tutor_cancellation_requests").select("booking_id").eq("status", "open"),
      supabase.from("session_reports").select("booking_id").then(
        (r) => r,
        () => ({ data: null, error: null }),
      ),
    ]);

  const reportsReady = !reportsRes.error;
  const reportedBookings = new Set(
    reportsReady ? ((reportsRes.data ?? []) as { booking_id: string }[]).map((r) => r.booking_id) : [],
  );

  return {
    profile: profile as {
      timezone: string | null;
      comp_rate_cents_per_hour: number | null;
      comp_currency: string | null;
      status: string | null;
    } | null,
    bookings: (bookingsRaw ?? []) as unknown as GuideBooking[],
    availability: (avail ?? []) as GuideAvailabilityBlock[],
    exceptions: (exc ?? []) as GuideExceptionRow[],
    earnings: (earningsRaw ?? []) as GuideEarning[],
    openRequestIds: new Set(((reqs ?? []) as { booking_id: string }[]).map((r) => r.booking_id)),
    reportsReady,
    reportedBookings,
  };
}
