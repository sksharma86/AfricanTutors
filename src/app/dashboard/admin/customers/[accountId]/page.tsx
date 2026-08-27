import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminWhen } from "@/components/dashboard/admin-when";
import { ADMIN_PORTAL_NAV, DashboardShell } from "@/components/dashboard/dashboard-shell";
import { lookupEmail } from "@/lib/admin-service";
import { requireRole } from "@/lib/auth";
import { formatCents } from "@/lib/pricing";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Customer · Management" };
export const dynamic = "force-dynamic";

function splitCustomerBookings<T extends { status: string; scheduled_start: string | null }>(bks: T[]) {
  const now = Date.now();
  return {
    upcoming: bks.filter((b) => (b.status === "confirmed" || b.status === "pending") && b.scheduled_start && new Date(b.scheduled_start).getTime() >= now),
    completed: bks.filter((b) => b.status === "completed" || b.status === "no_show"),
  };
}

export default async function AdminCustomerDetailPage({
  params,
}: {
  params: Promise<{ accountId: string }>;
}) {
  const { accountId } = await params;
  await requireRole("admin", `/dashboard/admin/customers/${accountId}`);
  const supabase = await createSupabaseServerClient();

  const [
    { data: profile },
    { data: children },
    { data: bookings },
    balancesRes,
    { data: payments },
    { data: reports },
    { data: recordings },
    { data: minuteLedger },
    { data: creditLedger },
  ] =
    await Promise.all([
      supabase!.from("profiles").select("id, display_name, phone_e164, role, created_at").eq("id", accountId).maybeSingle(),
      supabase!.from("students").select("id, full_name, grade_level").eq("account_id", accountId),
      supabase!
        .from("bookings")
        .select("id, student_first_name, tutor_display_name, scheduled_start, status, public_reference")
        .eq("account_id", accountId)
        .order("scheduled_start", { ascending: false, nullsFirst: false })
        .limit(40),
      supabase!.rpc("get_customer_balances", { p_account: accountId }),
      supabase!
        .from("payments")
        .select("id, purpose, status, gross_cents, stripe_paid_cents, created_at")
        .eq("account_id", accountId)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase!
        .from("session_reports")
        .select("id, booking_id, created_at")
        .then((r) => r, () => ({ data: null, error: null })),
      supabase!
        .from("session_recordings")
        .select("id, booking_id, status, deleted_at")
        .then((r) => r, () => ({ data: null, error: null })),
      supabase!
        .from("package_minute_ledger")
        .select("id, minutes_delta, entry_type, reason, created_at")
        .eq("account_id", accountId)
        .order("created_at", { ascending: false })
        .limit(12),
      supabase!
        .from("dollar_credit_ledger")
        .select("id, amount_cents, entry_type, reason, created_at")
        .eq("account_id", accountId)
        .order("created_at", { ascending: false })
        .limit(12),
    ]);

  if (!profile || profile.role !== "student") notFound();

  const email = await lookupEmail(accountId);
  const minutes = (balancesRes.data as { package_minutes?: number } | null)?.package_minutes ?? 0;
  const credit = (balancesRes.data as { dollar_credit_cents?: number } | null)?.dollar_credit_cents ?? 0;
  const bks = (bookings ?? []) as {
    id: string;
    student_first_name: string | null;
    tutor_display_name: string | null;
    scheduled_start: string | null;
    status: string;
    public_reference: string;
  }[];
  const { upcoming, completed } = splitCustomerBookings(bks);
  const reportByBooking = new Set(((reports ?? []) as { booking_id: string }[]).map((r) => r.booking_id));
  const recByBooking = new Map(((recordings ?? []) as { booking_id: string; status: string; deleted_at: string | null }[]).map((r) => [r.booking_id, r]));
  const ledgerRows = [
    ...((minuteLedger ?? []) as { id: string; minutes_delta: number; entry_type: string; reason: string | null }[]).map((row) => ({
      id: `m-${row.id}`,
      title: `${row.minutes_delta > 0 ? "+" : ""}${Math.round((row.minutes_delta / 60) * 10) / 10} hours · ${row.entry_type.replace(/_/g, " ")}`,
      meta: row.reason,
    })),
    ...((creditLedger ?? []) as { id: string; amount_cents: number; entry_type: string; reason: string | null }[]).map((row) => ({
      id: `c-${row.id}`,
      title: `${formatCents(row.amount_cents)} · ${row.entry_type.replace(/_/g, " ")}`,
      meta: row.reason,
    })),
  ];

  return (
    <DashboardShell
      role="admin"
      title={profile.display_name ?? "Parent"}
      description="Support view of this parent account."
      navItems={ADMIN_PORTAL_NAV}
    >
      <p className="mb-5">
        <Link href="/dashboard/admin/customers" className="text-sm font-medium text-ink-500 hover:text-ink-800">
          ← Customers
        </Link>
      </p>

      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-[11px] font-medium tracking-wide text-ink-400 uppercase">Email</dt>
          <dd className="mt-1 text-ink-800">{email ?? "Not available on this record"}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-medium tracking-wide text-ink-400 uppercase">Phone</dt>
          <dd className="mt-1 text-ink-800">{profile.phone_e164 ?? "Not on file"}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-medium tracking-wide text-ink-400 uppercase">Prepaid hours</dt>
          <dd className="mt-1 text-ink-800">{Math.round((minutes / 60) * 10) / 10} hours</dd>
        </div>
        <div>
          <dt className="text-[11px] font-medium tracking-wide text-ink-400 uppercase">Account credit</dt>
          <dd className="mt-1 text-ink-800">{formatCents(credit)}</dd>
        </div>
      </dl>

      <section className="mt-8">
        <h2 className="text-sm font-semibold tracking-wide text-ink-500 uppercase">Children</h2>
        <ul className="mt-2 text-sm text-ink-800">
          {((children ?? []) as { id: string; full_name: string; grade_level: string | null }[]).length === 0 ? (
            <li className="text-ink-500">No children on file.</li>
          ) : (
            ((children ?? []) as { id: string; full_name: string; grade_level: string | null }[]).map((c) => (
              <li key={c.id}>
                {c.full_name}
                {c.grade_level ? ` · Grade ${c.grade_level}` : ""}
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold tracking-wide text-ink-500 uppercase">Upcoming Study Halls</h2>
        <BookingMini rows={upcoming} />
      </section>
      <section className="mt-8">
        <h2 className="text-sm font-semibold tracking-wide text-ink-500 uppercase">Completed Study Halls</h2>
        <ul className="mt-2 divide-y divide-ink-100 text-sm">
          {completed.length === 0 ? (
            <li className="py-2 text-ink-500">None yet.</li>
          ) : (
            completed.map((b) => {
              const rec = recByBooking.get(b.id);
              return (
                <li key={b.id} className="py-2">
                  <Link href={`/dashboard/admin/study-halls/${b.id}`} className="font-medium text-ink-900 hover:underline">
                    {b.student_first_name ?? "Child"}
                  </Link>
                  <p className="text-xs text-ink-400">
                    {b.scheduled_start ? <AdminWhen iso={b.scheduled_start} className="inline-block align-baseline" /> : "—"}
                    {reportByBooking.has(b.id) ? " · Report in" : " · No report"}
                    {rec ? (rec.deleted_at ? " · Recording deleted" : rec.status === "failed" ? " · Recording unavailable" : " · Recording") : ""}
                  </p>
                </li>
              );
            })
          )}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold tracking-wide text-ink-500 uppercase">Credits and hours</h2>
        <ul className="mt-2 divide-y divide-ink-100 text-sm">
          {ledgerRows.length === 0 ? (
            <li className="py-2 text-ink-500">No credit or hour adjustments.</li>
          ) : (
            ledgerRows.map((row) => (
              <li key={row.id} className="py-2">
                {row.title}
                {row.meta ? <span className="text-ink-400"> · {row.meta}</span> : null}
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold tracking-wide text-ink-500 uppercase">Payments</h2>
        <ul className="mt-2 divide-y divide-ink-100 text-sm">
          {((payments ?? []) as { id: string; purpose: string; status: string; stripe_paid_cents: number; created_at: string }[]).length === 0 ? (
            <li className="py-2 text-ink-500">No payments.</li>
          ) : (
            ((payments ?? []) as { id: string; purpose: string; status: string; stripe_paid_cents: number; created_at: string }[]).map((p) => (
              <li key={p.id} className="py-2">
                {p.purpose} · {formatCents(p.stripe_paid_cents)} · {p.status}
              </li>
            ))
          )}
        </ul>
        <p className="mt-3 text-sm">
          <Link href="/dashboard/admin/finance" className="font-medium text-gold-700 hover:underline">
            Adjust credit or hours in Finance
          </Link>
        </p>
      </section>
    </DashboardShell>
  );
}

function BookingMini({
  rows,
}: {
  rows: { id: string; student_first_name: string | null; tutor_display_name: string | null; scheduled_start: string | null }[];
}) {
  if (rows.length === 0) return <p className="mt-2 text-sm text-ink-500">None.</p>;
  return (
    <ul className="mt-2 divide-y divide-ink-100 text-sm">
      {rows.map((b) => (
        <li key={b.id} className="py-2">
          <Link href={`/dashboard/admin/study-halls/${b.id}`} className="font-medium text-ink-900 hover:underline">
            {b.student_first_name ?? "Child"}
          </Link>
          <p className="text-xs text-ink-400">
            {b.tutor_display_name ?? "No Guide"}
            {b.scheduled_start ? (
              <>
                {" · "}
                <AdminWhen iso={b.scheduled_start} className="inline-block align-baseline" />
              </>
            ) : null}
          </p>
        </li>
      ))}
    </ul>
  );
}
