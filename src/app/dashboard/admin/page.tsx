import type { Metadata } from "next";
import Link from "next/link";

import { AdminConsole, type AdminBooking } from "@/components/dashboard/admin-console";
import { AdminWhen } from "@/components/dashboard/admin-when";
import { GuideWorkforceActions } from "@/components/dashboard/guide-workforce-actions";
import { ADMIN_PORTAL_NAV, DashboardShell } from "@/components/dashboard/dashboard-shell";
import { Button, LinkButton } from "@/components/ui/button";
import { requireRole } from "@/lib/auth";
import { guideWorkforceLabel } from "@/lib/guide-workforce.mjs";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { approveTutorAction } from "./actions";

export const metadata: Metadata = {
  title: "Admin Dashboard",
};

interface GuideRow {
  profile_id: string;
  status: string;
  approved_at: string | null;
  profiles: { display_name: string | null } | null;
}

function statusChip(label: string) {
  const tone =
    label === "active"
      ? "border-ink-200 bg-white text-ink-700"
      : label === "pending"
        ? "border-gold-200 bg-gold-50 text-gold-800"
        : "border-ink-200 bg-[#f4f5f7] text-ink-600";
  const text =
    label === "active" ? "Active" : label === "pending" ? "Pending" : label === "rejected" ? "Rejected" : "Suspended";
  return (
    <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${tone}`}>{text}</span>
  );
}

export default async function AdminDashboardPage() {
  await requireRole("admin", "/dashboard/admin");
  const supabase = await createSupabaseServerClient();

  const [{ data: guideRows }, { data: bookings }, { data: cancelReqs }, { data: escalationsRaw }] =
    await Promise.all([
      supabase!
        .from("tutor_profiles")
        .select("profile_id, status, approved_at, profiles!tutor_profiles_profile_id_fkey(display_name)"),
      supabase!
        .from("bookings")
        .select(
          "id, public_reference, subject_name, other_subject_text, subject_id, student_first_name, tutor_display_name, scheduled_start, duration_minutes, status, is_free_trial, price_cents, payment_status, students(timezone)",
        )
        .order("scheduled_start", { ascending: false, nullsFirst: false }),
      supabase!
        .from("tutor_cancellation_requests")
        .select("id, reason, created_at, bookings(subject_name, scheduled_start, student_first_name, tutor_display_name)")
        .eq("status", "open")
        .order("created_at", { ascending: true }),
      supabase!
        .from("parent_escalation_requests")
        .select(
          "id, reason, status, outcome, created_at, call_status, answered_by, sms_status, bookings(public_reference, student_first_name, tutor_display_name, scheduled_start)",
        )
        .order("created_at", { ascending: false })
        .limit(25)
        .then(
          (r) => r,
          () => ({ data: null, error: null }),
        ),
    ]);

  const cancellationRequests = (cancelReqs ?? []) as unknown as {
    id: string;
    reason: string | null;
    created_at: string;
    bookings: {
      subject_name: string | null;
      scheduled_start: string | null;
      student_first_name: string | null;
      tutor_display_name: string | null;
    } | null;
  }[];
  const escalations = (escalationsRaw ?? []) as unknown as {
    id: string;
    reason: string;
    status: string;
    outcome: string | null;
    created_at: string;
    call_status: string | null;
    answered_by: string | null;
    sms_status: string | null;
    bookings: {
      public_reference: string | null;
      student_first_name: string | null;
      tutor_display_name: string | null;
      scheduled_start: string | null;
    } | null;
  }[];
  const allGuides = (guideRows ?? []) as unknown as GuideRow[];
  const pendingTutors = allGuides.filter((t) => t.status === "pending");
  const activeGuides = allGuides.filter((t) => t.status === "approved");
  const suspendedGuides = allGuides.filter((t) => guideWorkforceLabel(t.status, t.approved_at) === "suspended");
  const rejectedGuides = allGuides.filter((t) => guideWorkforceLabel(t.status, t.approved_at) === "rejected");

  return (
    <DashboardShell
      role="admin"
      title="Operations overview"
      description="Manage Guides, sessions, coverage, reports, and financial operations."
      navItems={ADMIN_PORTAL_NAV}
    >
      <section id="overview" className="scroll-mt-24 mb-8 flex flex-col gap-3 rounded-2xl border border-ink-100 bg-ink-900 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold text-white">Financial operations</h2>
          <p className="mt-1 text-sm text-ink-200">
            Guide earnings &amp; payouts, customer balances &amp; adjustments, refunds, and disputes.
          </p>
        </div>
        <LinkButton href="/dashboard/admin/finance" variant="secondary" size="lg">
          Open finance console
        </LinkButton>
      </section>

      <section id="guide-approvals" className="scroll-mt-24 mb-8 rounded-2xl border border-ink-100 bg-white p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-ink-900">Guide approvals</h2>
          <span className="rounded-full bg-ink-100 px-2.5 py-0.5 text-xs font-semibold text-ink-600">
            {pendingTutors.length} pending
          </span>
        </div>
        <p className="mt-1 text-sm text-ink-500">
          Approve applicants as Study Hall Guides. Guides supervise homework routines — they are not matched by academic
          subject.
        </p>
        {pendingTutors.length === 0 ? (
          <p className="mt-6 rounded-lg border border-dashed border-ink-200 px-4 py-6 text-center text-sm text-ink-400">
            No pending Guide applications.
          </p>
        ) : (
          <ul className="mt-5 divide-y divide-ink-100">
            {pendingTutors.map((tutor) => (
              <li key={tutor.profile_id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-ink-900">
                    {tutor.profiles?.display_name ?? "Unnamed applicant"}
                  </p>
                  <p className="text-xs text-ink-400">Guide application · awaiting review</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <form action={approveTutorAction}>
                    <input type="hidden" name="profileId" value={tutor.profile_id} />
                    <Button type="submit" className="px-4 py-2 text-sm">
                      Approve as Guide
                    </Button>
                  </form>
                  <GuideWorkforceActions profileId={tutor.profile_id} label="pending" compact />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mb-8 rounded-2xl border border-ink-100 bg-white p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-ink-900">Guide cancellation requests</h2>
          <span className="rounded-full bg-ink-100 px-2.5 py-0.5 text-xs font-semibold text-ink-600">
            {cancellationRequests.length} open
          </span>
        </div>
        {cancellationRequests.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed border-ink-200 px-4 py-6 text-center text-sm text-ink-400">
            No open Guide cancellation requests.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-ink-100">
            {cancellationRequests.map((r) => (
              <li key={r.id} className="py-3">
                <p className="text-sm font-medium text-ink-900">
                  Study Hall · Guide {r.bookings?.tutor_display_name ?? "—"}
                </p>
                <p className="text-xs text-ink-500">
                  Child {r.bookings?.student_first_name ?? "—"}
                  {r.bookings?.scheduled_start ? (
                    <>
                      {" · "}
                      <AdminWhen iso={r.bookings.scheduled_start} className="inline-block align-baseline" />
                    </>
                  ) : null}
                </p>
                {r.reason ? <p className="mt-1 text-sm text-ink-600">Reason: {r.reason}</p> : null}
                <p className="mt-1 text-xs text-ink-400">
                  Automatic reassignment runs when a Guide becomes unavailable. Open requests mean coverage could not be
                  restored — use Sessions below to Reassign (eligible Guides only) or Release. Successful reassignment
                  stays invisible to the parent.
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mb-8 rounded-2xl border border-ink-100 bg-white p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-ink-900">Call Parent escalations</h2>
          <span className="rounded-full bg-ink-100 px-2.5 py-0.5 text-xs font-semibold text-ink-600">
            {escalations.length} recent
          </span>
        </div>
        {escalations.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed border-ink-200 px-4 py-6 text-center text-sm text-ink-400">
            No Call Parent events yet.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-ink-100">
            {escalations.map((e) => (
              <li key={e.id} className="py-3">
                <p className="text-sm font-medium text-ink-900">
                  {e.bookings?.student_first_name ?? "Child"} · Guide {e.bookings?.tutor_display_name ?? "—"}
                </p>
                <p className="text-xs text-ink-500">
                  <AdminWhen iso={e.created_at} className="inline-block align-baseline" />
                  {e.bookings?.public_reference ? ` · Ref ${e.bookings.public_reference}` : ""}
                  {e.bookings?.scheduled_start ? (
                    <>
                      {" · Session "}
                      <AdminWhen iso={e.bookings.scheduled_start} className="inline-block align-baseline" />
                    </>
                  ) : null}
                </p>
                <p className="mt-1 text-sm text-ink-600">
                  Reason: {e.reason.replace(/_/g, " ")} · Status: {e.status}
                  {e.outcome ? ` · Outcome: ${e.outcome}` : ""}
                  {e.call_status ? ` · Call: ${e.call_status}` : ""}
                  {e.answered_by ? ` · AMD: ${e.answered_by}` : ""}
                  {e.sms_status ? ` · SMS: ${e.sms_status}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mb-8 rounded-2xl border border-ink-100 bg-white p-6">
        <h2 className="font-display text-lg font-semibold text-ink-900">Guide directory</h2>
        <p className="mt-1 text-sm text-ink-500">
          Pending, active, suspended, and rejected Guides. Open a Guide for rate, history, and workforce actions.
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs text-ink-500">
          <span>{pendingTutors.length} pending</span>
          <span>· {activeGuides.length} active</span>
          <span>· {suspendedGuides.length} suspended</span>
          <span>· {rejectedGuides.length} rejected</span>
        </div>
        {allGuides.length === 0 ? (
          <p className="mt-4 text-sm text-ink-400">No Guide records yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-ink-100">
            {allGuides.map((t) => {
              const label = guideWorkforceLabel(t.status, t.approved_at);
              return (
                <li key={t.profile_id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-2">
                    <Link
                      href={`/dashboard/admin/tutors/${t.profile_id}`}
                      className="truncate text-sm font-medium text-ink-800 hover:underline"
                    >
                      {t.profiles?.display_name ?? t.profile_id.slice(0, 8)}
                    </Link>
                    {statusChip(label)}
                  </div>
                  <GuideWorkforceActions profileId={t.profile_id} label={label} compact />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section id="sessions" className="scroll-mt-24 mb-8">
        <AdminConsole
          bookings={((bookings ?? []) as unknown as (Omit<AdminBooking, "student_timezone"> & {
            students: { timezone: string | null } | null;
          })[]).map((b) => ({
            ...b,
            student_timezone: b.students?.timezone ?? null,
          }))}
        />
      </section>
    </DashboardShell>
  );
}
