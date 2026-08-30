declare module "@/lib/management-console.mjs" {
  export function managementClockLabel(nowMs?: number, tz?: string): string;
  export function managementTodayShort(nowMs?: number, tz?: string): string;
  export function managementTodayPulse<T extends { id: string; status: string; scheduled_start?: string | null; scheduled_end?: string | null; tutor_id?: string | null; tutor_display_name?: string | null }>(
    bookings: T[],
    presenceByBooking: Record<string, object | undefined>,
    tz: string,
    nowMs?: number,
  ): {
    todayKey: string;
    count: number;
    live: number;
    upcoming: number;
    completed: number;
    liveRows: T[];
    nextRows: T[];
    next: T | null;
  };
  export function managementTodayWorkload(
    bookings: { scheduled_start?: string | null; status: string; tutor_display_name?: string | null }[],
    tz: string,
    nowMs?: number,
  ): { name: string; sessions: number }[];
  export function managementCoverageSummary(
    bookings: { scheduled_start?: string | null; status: string; tutor_id?: string | null; tutor_display_name?: string | null }[],
    guides: { status: string; approved_at?: string | null }[],
    tz: string,
    nowMs?: number,
  ): {
    active: number;
    applications: number;
    todayOpen: number;
    assigned: number;
    needing: number;
    covered: boolean;
  };
  export function managementRecentActivity(
    bookings: { id: string; status: string; scheduled_start?: string | null; scheduled_end?: string | null; tutor_display_name?: string | null; student_first_name?: string | null; student_first_names?: string[] | null }[],
    reports: { booking_id?: string | null; submitted_at?: string | null }[],
    nowMs?: number,
  ): { id: string; at: number; type: string; details: string; related: string; by: string; href: string }[];
  export function managementPaymentsTodayCents(
    payments: { created_at?: string | null; status?: string; stripe_paid_cents?: number }[],
    tz: string,
    nowMs?: number,
  ): number;
}
