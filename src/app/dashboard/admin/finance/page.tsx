import type { Metadata } from "next";

import {
  AdminFinanceConsole,
  type DisputeRow,
  type EarningRow,
  type GuideCompRow,
  type PaymentRow,
} from "@/components/dashboard/admin-finance-console";
import { ADMIN_PORTAL_NAV } from "@/components/dashboard/dashboard-shell";
import { ManagementPage } from "@/components/dashboard/management-page";
import { requireRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Finance · Management" };

export default async function AdminFinancePage() {
  await requireRole("admin", "/dashboard/admin/finance");
  const supabase = await createSupabaseServerClient();

  const [{ data: earnings }, { data: disputes }, { data: payments }, { data: tutors }, { data: bookings }] =
    await Promise.all([
      supabase!
        .from("tutor_earnings")
        .select("id, tutor_id, booking_id, duration_minutes, rate_cents_per_hour, amount_cents, currency, status, earned_at, paid_at, adjusted_from_cents, reason")
        .order("earned_at", { ascending: false, nullsFirst: false })
        .limit(200),
      supabase!
        .from("disputes")
        .select("id, booking_id, account_id, tutor_id, category, complaint, status, resolution, created_at, reviewed_at")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase!
        .from("payments")
        .select("id, account_id, purpose, gross_cents, stripe_paid_cents, credit_applied_cents, refunded_cents, status, booking_id")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase!
        .from("tutor_profiles")
        .select("profile_id, status, comp_rate_cents_per_hour, comp_currency, profiles!tutor_profiles_profile_id_fkey(display_name)"),
      supabase!
        .from("bookings")
        .select("id, subject_name, scheduled_start, public_reference, student_first_name, student_first_names, tutor_id")
        .order("scheduled_start", { ascending: false, nullsFirst: false })
        .limit(300)
        .then((r) =>
          r.error && /student_first_names/i.test(r.error.message)
            ? supabase!
                .from("bookings")
                .select("id, subject_name, scheduled_start, public_reference, student_first_name, tutor_id")
                .order("scheduled_start", { ascending: false, nullsFirst: false })
                .limit(300)
            : r,
        ),
    ]);

  // Recording metadata for the disputes under review (admin-only RLS).
  const disputeBookingIds = Array.from(new Set(((disputes ?? []) as { booking_id: string }[]).map((d) => d.booking_id)));
  const { data: recordings } = disputeBookingIds.length
    ? await supabase!
        .from("session_recordings")
        .select("id, booking_id, status, duration_seconds, completed_at, retention_until, deleted_at")
        .in("booking_id", disputeBookingIds)
    : { data: [] };
  const recordingsByBooking = new Map<
    string,
    {
      id: string;
      status: string;
      duration_seconds: number | null;
      completed_at: string | null;
      retention_until: string | null;
      deleted_at: string | null;
    }[]
  >();
  for (const r of (recordings ?? []) as {
    id: string;
    booking_id: string;
    status: string;
    duration_seconds: number | null;
    completed_at: string | null;
    retention_until: string | null;
    deleted_at: string | null;
  }[]) {
    const arr = recordingsByBooking.get(r.booking_id) ?? [];
    arr.push({
      id: r.id,
      status: r.status,
      duration_seconds: r.duration_seconds,
      completed_at: r.completed_at,
      retention_until: r.retention_until,
      deleted_at: r.deleted_at,
    });
    recordingsByBooking.set(r.booking_id, arr);
  }

  const tutorName = new Map<string, string>();
  const guideRows: GuideCompRow[] = [];
  for (const t of (tutors ?? []) as unknown as {
    profile_id: string;
    status: string;
    comp_rate_cents_per_hour: number | null;
    comp_currency: string | null;
    profiles: { display_name: string | null } | null;
  }[]) {
    const name = t.profiles?.display_name ?? t.profile_id.slice(0, 8);
    tutorName.set(t.profile_id, name);
    guideRows.push({
      profile_id: t.profile_id,
      name,
      rate_cents: t.comp_rate_cents_per_hour,
      currency: t.comp_currency ?? "USD",
    });
  }
  const bookingMap = new Map<string, { subject: string | null; when: string | null; ref: string | null; student: string | null }>();
  for (const b of (bookings ?? []) as { id: string; subject_name: string | null; scheduled_start: string | null; public_reference: string | null; student_first_name: string | null; student_first_names?: string[] | null }[]) {
    bookingMap.set(b.id, {
      subject: b.subject_name,
      when: b.scheduled_start,
      ref: b.public_reference,
      student: Array.isArray(b.student_first_names) && b.student_first_names.length
        ? b.student_first_names.join(" & ")
        : b.student_first_name,
    });
  }

  const earningRows: EarningRow[] = ((earnings ?? []) as EarningRow[]).map((e) => ({
    ...e,
    tutor_name: tutorName.get(e.tutor_id) ?? e.tutor_id.slice(0, 8),
    subject: e.booking_id ? bookingMap.get(e.booking_id)?.subject ?? null : null,
    when: e.booking_id ? bookingMap.get(e.booking_id)?.when ?? null : null,
  }));
  const disputeRows: DisputeRow[] = ((disputes ?? []) as DisputeRow[]).map((d) => ({
    ...d,
    ref: bookingMap.get(d.booking_id)?.ref ?? null,
    subject: bookingMap.get(d.booking_id)?.subject ?? null,
    when: bookingMap.get(d.booking_id)?.when ?? null,
    tutor_name: d.tutor_id ? tutorName.get(d.tutor_id) ?? null : null,
    recordings: recordingsByBooking.get(d.booking_id) ?? [],
  }));
  const paymentRows: PaymentRow[] = ((payments ?? []) as PaymentRow[]).map((p) => ({
    ...p,
    ref: p.booking_id ? bookingMap.get(p.booking_id)?.ref ?? null : null,
  }));

  return (
    <ManagementPage navItems={ADMIN_PORTAL_NAV} wide>
      <h1 className="font-display text-[1.35rem] font-semibold tracking-[-0.03em] text-[var(--mg-ink)]">Finance</h1>
      <p className="mt-1 text-sm text-[var(--mg-muted)]">
        Customer money stays USD. Guide pay is a separate ledger and may use more than one currency.
      </p>
      <div className="mt-4">
        <AdminFinanceConsole
          earnings={earningRows}
          guides={guideRows}
          disputes={disputeRows}
          payments={paymentRows}
        />
      </div>
    </ManagementPage>
  );
}
