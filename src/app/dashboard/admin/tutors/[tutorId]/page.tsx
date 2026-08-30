import type { Metadata } from "next";
import Link from "next/link";

import { GuideWorkforceActions } from "@/components/dashboard/guide-workforce-actions";
import { TutorRateForm } from "@/components/dashboard/tutor-rate-form";
import { ADMIN_PORTAL_NAV } from "@/components/dashboard/dashboard-shell";
import { ManagementPage } from "@/components/dashboard/management-page";
import { requireRole } from "@/lib/auth";
import {
  aggregateCompensationByCurrency,
  formatCompensationHourly,
  formatCompensationMinor,
  formatCompensationTotals,
} from "@/lib/compensation-currency.mjs";
import { guideWorkforceLabel } from "@/lib/guide-workforce.mjs";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Admin — Guide detail" };
export const dynamic = "force-dynamic";

// Module-scope so `Date` isn't called in the Server Component render body.
function listUpcoming<T extends { status: string; scheduled_start: string | null }>(bks: T[]): T[] {
  const now = new Date().getTime();
  return bks.filter(
    (b) =>
      (b.status === "confirmed" || b.status === "pending") &&
      b.scheduled_start &&
      new Date(b.scheduled_start).getTime() > now,
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[6rem]">
      <p className="text-[11px] font-medium tracking-wide text-ink-400 uppercase">{label}</p>
      <p className="mt-1 font-display text-lg font-semibold text-ink-900">{value}</p>
    </div>
  );
}

export default async function AdminTutorDetailPage({ params }: { params: Promise<{ tutorId: string }> }) {
  const { tutorId } = await params;
  await requireRole("admin", `/dashboard/admin/tutors/${tutorId}`);
  const supabase = await createSupabaseServerClient();

  const [{ data: prof }, { data: bookings }, { data: earnings }, { data: disputes }, { data: reqs }, { data: avail }] =
    await Promise.all([
      supabase!
        .from("tutor_profiles")
        .select("status, approved_at, bio, timezone, comp_rate_cents_per_hour, comp_currency, profiles!tutor_profiles_profile_id_fkey(display_name)")
        .eq("profile_id", tutorId)
        .maybeSingle(),
      supabase!.from("bookings").select("id, status, scheduled_start, public_reference, student_first_name").eq("tutor_id", tutorId),
      supabase!.from("tutor_earnings").select("amount_cents, status, currency").eq("tutor_id", tutorId),
      supabase!.from("disputes").select("id").eq("tutor_id", tutorId),
      supabase!.from("tutor_cancellation_requests").select("id, status").eq("tutor_id", tutorId),
      supabase!.from("tutor_availability").select("id").eq("tutor_id", tutorId),
    ]);

  const profile = prof as unknown as {
    status: string;
    approved_at: string | null;
    bio: string | null;
    timezone: string | null;
    comp_rate_cents_per_hour: number | null;
    comp_currency: string | null;
    profiles: { display_name: string | null } | null;
  } | null;
  const name = profile?.profiles?.display_name ?? tutorId.slice(0, 8);
  const workforceLabel = guideWorkforceLabel(profile?.status, profile?.approved_at);

  const bks = (bookings ?? []) as {
    id: string;
    status: string;
    scheduled_start: string | null;
    public_reference: string | null;
    student_first_name: string | null;
  }[];
  const upcomingRows = listUpcoming(bks);
  const upcoming = upcomingRows.length;
  const completed = bks.filter((b) => b.status === "completed").length;
  const cancelled = bks.filter((b) => b.status === "cancelled").length;
  const noShow = bks.filter((b) => b.status === "no_show").length;

  const compCurrency = profile?.comp_currency ?? "USD";
  const totals = aggregateCompensationByCurrency(
    ((earnings ?? []) as { amount_cents: number; status: string; currency?: string | null }[]).map((e) => ({
      ...e,
      currency: e.currency ?? "USD",
    })),
  );
  const disputeCount = (disputes ?? []).length;
  const availCount = (avail ?? []).length;
  const openRequests = ((reqs ?? []) as { status: string }[]).filter((r) => r.status === "open").length;

  return (
    <ManagementPage navItems={ADMIN_PORTAL_NAV} wide>
      <h1 className="font-display text-[1.35rem] font-semibold tracking-[-0.03em] text-[var(--mg-ink)]">{name}</h1>
      <Link href="/dashboard/admin/guides" className="text-sm font-medium text-ink-500 hover:text-ink-800">
        ← Guides
      </Link>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm capitalize text-ink-600">{workforceLabel}</span>
      </div>
        <div className="mt-4">
          <GuideWorkforceActions
            profileId={tutorId}
            label={workforceLabel}
            futureCount={upcoming}
            futureAssignments={upcomingRows}
          />
        </div>
        <p className="mt-1 text-sm text-ink-500">
          Timezone: {profile?.timezone ?? "—"} · Rate:{" "}
          {typeof profile?.comp_rate_cents_per_hour === "number"
            ? formatCompensationHourly(profile.comp_rate_cents_per_hour, compCurrency)
            : "not set"}
        </p>
        {profile?.bio ? (
          <p className="mt-3 text-sm text-ink-700">{profile.bio}</p>
        ) : null}

        <h2 className="mt-8 mb-3 text-sm font-semibold tracking-wide text-ink-500 uppercase">Compensation</h2>
        <TutorRateForm
          tutorId={tutorId}
          initialRateCents={profile?.comp_rate_cents_per_hour ?? null}
          initialCurrency={compCurrency}
        />

        <h2 className="mt-8 mb-3 text-sm font-semibold tracking-wide text-ink-500 uppercase">Operations</h2>
        <div className="flex flex-wrap gap-x-8 gap-y-4 border-y border-ink-100 py-4">
          <Stat label="Upcoming" value={String(upcoming)} />
          <Stat label="Completed" value={String(completed)} />
          <Stat label="Cancelled" value={String(cancelled)} />
          <Stat label="No-shows" value={String(noShow)} />
          <Stat
            label="Earned"
            value={
              totals.length === 0
                ? formatCompensationMinor(0, compCurrency)
                : formatCompensationTotals(totals, "earned")
            }
          />
          <Stat
            label="Paid"
            value={
              totals.length === 0
                ? formatCompensationMinor(0, compCurrency)
                : formatCompensationTotals(totals, "paid")
            }
          />
          <Stat
            label="Outstanding"
            value={
              totals.length === 0
                ? formatCompensationMinor(0, compCurrency)
                : formatCompensationTotals(totals, "outstanding")
            }
          />
          <Stat label="Disputes" value={String(disputeCount)} />
          <Stat label="Open cancel requests" value={String(openRequests)} />
        </div>
      <p className="mt-3 text-xs text-ink-400">
        Availability blocks: {availCount} · Operational visibility only (no scoring / automatic action). Guides are
        not assigned by academic subject.
      </p>
    </ManagementPage>
  );
}
