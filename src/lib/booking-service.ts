import "server-only";

import { BOOKING_HORIZON_DAYS, MIN_BOOKING_NOTICE_MINUTES } from "@/lib/booking-config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Server-side booking service. This is the ONLY layer the future student/tutor/
 * admin UI should call for booking operations. It runs with the authenticated
 * user's Supabase session (RLS enforced) and NEVER uses the service role, so
 * nothing here can be exploited from the browser to bypass ownership/pricing.
 *
 * All booking-critical rules (pricing, free-trial eligibility, matching,
 * double-booking) are enforced by the SECURITY DEFINER SQL functions and
 * constraints from Prompts 3A/3B — this layer only forwards intent.
 */

export interface SubjectDTO {
  id: string;
  name: string;
  category: string;
}
export interface StudentDTO {
  id: string;
  full_name: string;
  grade_level: string | null;
  timezone: string;
}

async function client() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase is not configured");
  return supabase;
}

/** Active subjects for the booking catalog (RLS: active subjects are public). */
export async function listActiveSubjects(): Promise<SubjectDTO[]> {
  const supabase = await client();
  const { data, error } = await supabase
    .from("subjects")
    .select("id, name, category")
    .eq("is_active", true)
    .order("category")
    .order("name");
  if (error) throw new Error(error.message);
  return (data ?? []) as SubjectDTO[];
}

/** Students owned by the current account (RLS: account_id = auth.uid()). */
export async function listMyStudents(): Promise<StudentDTO[]> {
  const supabase = await client();
  const { data, error } = await supabase
    .from("students")
    .select("id, full_name, grade_level, timezone")
    .order("created_at");
  if (error) throw new Error(error.message);
  return (data ?? []) as StudentDTO[];
}

/** Whether the given customer account has consumed its one free trial (account-scoped). */
export async function accountFreeTrialUsed(accountId: string): Promise<boolean> {
  const supabase = await client();
  const { data, error } = await supabase.rpc("account_has_used_free_trial", { p_account: accountId });
  if (error) throw new Error(error.message);
  return Boolean(data);
}

/**
 * Bookable UTC start instants for Study Hall (null subject) or a legacy subject
 * + duration. Authoritative times are UTC; the UI converts to the student's
 * IANA timezone for display.
 */
export async function getAvailableSlots(params: {
  subjectId: string | null;
  duration: 60 | 120 | 180;
  fromISO?: string;
  toISO?: string;
  slotMinutes?: number;
}): Promise<string[]> {
  const supabase = await client();
  const from = params.fromISO ?? new Date(Date.now() + MIN_BOOKING_NOTICE_MINUTES * 60000).toISOString();
  const to = params.toISO ?? new Date(Date.now() + BOOKING_HORIZON_DAYS * 86400000).toISOString();
  const { data, error } = await supabase.rpc("get_available_slots", {
    p_subject_id: params.subjectId,
    p_duration: params.duration,
    p_from: from,
    p_to: to,
    p_slot_minutes: params.slotMinutes ?? 30,
  });
  if (error) throw new Error(error.message);
  return ((data ?? []) as { slot_start: string }[]).map((r) => r.slot_start);
}

/**
 * Request a booking. Price, free-trial eligibility, tutor matching, and
 * double-booking are all enforced server-side by `create_booking`. The client
 * cannot set price, choose a tutor, or force free-trial on a non-60-min session.
 * Returns the new booking id.
 */
export async function requestBooking(params: {
  studentId: string;
  studentIds?: string[];
  subjectId: string | null;
  otherSubject?: string | null;
  note?: string | null;
  duration: 60 | 120 | 180;
  startISO: string | null;
  isFreeTrial: boolean;
}): Promise<string> {
  const supabase = await client();
  const { data, error } = await supabase.rpc("create_booking", {
    p_student_id: params.studentId,
    p_subject_id: params.subjectId,
    p_other_subject: params.subjectId ? null : (params.otherSubject ?? null),
    p_request_note: params.note ?? null,
    p_duration: params.duration,
    p_start: params.startISO,
    p_is_free_trial: params.isFreeTrial,
    p_student_ids: params.studentIds ?? [params.studentId],
  });
  if (error) throw new Error(error.message);
  return data as string;
}

/** Cancel a booking the caller owns (or admin). Conservative — see DECISIONS.md. */
export async function cancelBooking(bookingId: string): Promise<void> {
  const supabase = await client();
  const { error } = await supabase.rpc("cancel_booking", { p_booking: bookingId });
  if (error) throw new Error(error.message);
}

/** Confirmation/detail data for a booking the caller is allowed to read (RLS). */
export async function getBookingConfirmation(bookingId: string) {
  const supabase = await client();
  const { data, error } = await supabase
    .from("bookings")
    .select(
      "id, public_reference, subject_name, other_subject_text, scheduled_start, scheduled_end, duration_minutes, price_cents, is_free_trial, status, payment_status, tutor_display_name, student_first_name, student_first_names, child_count",
    )
    .eq("id", bookingId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}
