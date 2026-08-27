import "server-only";

import { collectNeedsAttention as collectNeedsAttentionImpl } from "@/lib/management-ops.mjs";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

const collectNeedsAttention = collectNeedsAttentionImpl as (input: object) => {
  id: string;
  kind: string;
  title: string;
  detail: string;
  bookingId?: string | null;
  href: string;
  action: string;
}[];

type SB = NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>;

export async function loadManagementWorkspace(supabase: SB) {
  const [
    bookingsRes,
    guidesRes,
    cancelRes,
    escRes,
    failRes,
    recRes,
    disputeRes,
    reportRes,
    earningsRes,
  ] = await Promise.all([
    supabase
      .from("bookings")
      .select(
        "id, public_reference, account_id, student_id, tutor_id, student_first_name, tutor_display_name, scheduled_start, scheduled_end, duration_minutes, status, is_free_trial, price_cents, payment_status, students(full_name, timezone)",
      )
      .order("scheduled_start", { ascending: false, nullsFirst: false })
      .limit(400),
    supabase
      .from("tutor_profiles")
      .select(
        "profile_id, status, approved_at, timezone, comp_rate_cents_per_hour, comp_currency, profiles!tutor_profiles_profile_id_fkey(display_name)",
      ),
    supabase
      .from("tutor_cancellation_requests")
      .select("id, booking_id, reason, created_at, bookings(student_first_name, tutor_display_name, scheduled_start)")
      .eq("status", "open")
      .order("created_at", { ascending: true }),
    supabase
      .from("parent_escalation_requests")
      .select("id, booking_id, status, outcome, reason, created_at, bookings(student_first_name, scheduled_start)")
      .order("created_at", { ascending: false })
      .limit(40)
      .then((r) => r, () => ({ data: null, error: null })),
    supabase
      .from("email_deliveries")
      .select("id, notification_type, to_email, booking_id, status, error, updated_at")
      .eq("status", "failed")
      .order("updated_at", { ascending: false })
      .limit(40),
    supabase
      .from("session_recordings")
      .select("id, booking_id, status")
      .eq("status", "failed")
      .limit(40)
      .then((r) => r, () => ({ data: null, error: null })),
    supabase
      .from("disputes")
      .select("id, booking_id, status")
      .in("status", ["open", "under_review"])
      .limit(40),
    supabase.from("session_reports").select("booking_id").then((r) => r, () => ({ data: null, error: null })),
    supabase.from("tutor_earnings").select("amount_cents, status, currency"),
  ]);

  const parentIds = Array.from(
    new Set(((bookingsRes.data ?? []) as { account_id: string }[]).map((b) => b.account_id).filter(Boolean)),
  );
  const { data: parents } = parentIds.length
    ? await supabase.from("profiles").select("id, display_name, phone_e164").in("id", parentIds)
    : { data: [] };
  const parentName = new Map((parents ?? []).map((p) => [p.id as string, (p.display_name as string | null) ?? null]));

  const bookingIds = ((bookingsRes.data ?? []) as { id: string }[]).map((b) => b.id);
  const { data: presenceRows } = bookingIds.length
    ? await supabase
        .from("session_presence")
        .select("booking_id, student_first_joined_at, tutor_first_joined_at")
        .in("booking_id", bookingIds)
    : { data: [] };

  const presenceByBooking: Record<
    string,
    { student_first_joined_at?: string | null; tutor_first_joined_at?: string | null }
  > = {};
  for (const row of presenceRows ?? []) {
    presenceByBooking[row.booking_id as string] = {
      student_first_joined_at: row.student_first_joined_at as string | null,
      tutor_first_joined_at: row.tutor_first_joined_at as string | null,
    };
  }

  const reported = new Set(((reportRes.data ?? []) as { booking_id: string }[]).map((r) => r.booking_id));
  const now = Date.now();
  const dayAgo = now - 24 * 60 * 60 * 1000;

  const bookings = ((bookingsRes.data ?? []) as unknown as Record<string, unknown>[]).map((b) => {
    const students = b.students as { full_name?: string | null; timezone?: string | null } | null;
    return {
      ...b,
      student_full_name: students?.full_name ?? null,
      student_timezone: students?.timezone ?? null,
      parent_name: parentName.get(b.account_id as string) ?? null,
    };
  }) as Record<string, unknown>[];

  const missingReports = bookings.filter((b) => {
    if (b.status !== "completed") return false;
    if (reported.has(b.id as string)) return false;
    const end = b.scheduled_end ? new Date(b.scheduled_end as string).getTime() : 0;
    return end > 0 && end < dayAgo;
  });

  const recFails = ((recRes.data ?? []) as { id: string; booking_id: string }[]).map((r) => {
    const b = bookings.find((x) => x.id === r.booking_id);
    return { ...r, student_first_name: (b?.student_first_name as string | null) ?? null };
  });

  const pendingApplicants = ((guidesRes.data ?? []) as unknown as { profile_id: string; status: string; profiles: { display_name: string | null } | null }[])
    .filter((g) => g.status === "pending")
    .map((g) => ({ profile_id: g.profile_id, display_name: g.profiles?.display_name ?? null }));

  const attentionItems = collectNeedsAttention({
    bookings,
    presenceByBooking,
    cancelRequests: (cancelRes.data ?? []) as object[],
    escalations: (escRes.data ?? []) as object[],
    emailFailures: (failRes.data ?? []) as object[],
    recordingFailures: recFails,
    disputes: (disputeRes.data ?? []) as object[],
    missingReports,
    pendingApplicants,
    nowMs: now,
  });

  return {
    bookings,
    guides: guidesRes.data ?? [],
    presenceByBooking,
    attentionItems,
    earnings: earningsRes.data ?? [],
    cancelRequests: cancelRes.data ?? [],
    escalations: escRes.data ?? [],
    emailFailures: failRes.data ?? [],
  };
}
