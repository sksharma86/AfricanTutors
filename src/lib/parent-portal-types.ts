import type { BookingStatus } from "@/lib/booking-config";
import type { FocusRating, RedirectionLevel } from "@/lib/session-report.mjs";

/** Parent-visible booking row. Presentation only — no admin/Daily fields. */
export type ParentBooking = {
  id: string;
  student_id: string;
  public_reference: string;
  subject_name: string | null;
  other_subject_text: string | null;
  request_note: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  duration_minutes: number | null;
  status: BookingStatus;
  is_free_trial: boolean;
  payment_status: string;
  tutor_display_name: string | null;
  students: { full_name: string; timezone: string } | null;
};

export type ParentStudent = { id: string; full_name: string; grade_level: string | null };

export type ParentRecording = {
  id: string;
  booking_id: string;
  status: string;
  retention_until: string | null;
  deleted_at: string | null;
  daily_recording_id: string | null;
  completed_at: string | null;
};

export type ParentReport = {
  id: string;
  booking_id: string;
  submitted_at: string;
  focus_rating: FocusRating;
  work_summary: string;
  redirection_level: RedirectionLevel;
  guide_note: string | null;
};
