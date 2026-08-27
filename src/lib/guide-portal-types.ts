import type { BookingStatus } from "@/lib/booking-config";

export interface GuideBooking {
  id: string;
  subject_name: string | null;
  other_subject_text: string | null;
  student_first_name: string | null;
  student_grade: string | null;
  request_note: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  duration_minutes: number | null;
  status: BookingStatus;
  is_free_trial: boolean;
}

export interface GuideEarning {
  booking_id: string | null;
  amount_cents: number;
  status: string;
  earned_at: string | null;
  paid_at: string | null;
  currency?: string | null;
}
