import type { Metadata } from "next";
import Link from "next/link";

import { TutorRateForm } from "@/components/dashboard/tutor-rate-form";
import { Container } from "@/components/ui/container";
import { requireRole } from "@/lib/auth";
import { formatCents } from "@/lib/pricing";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Admin — Guide detail" };
export const dynamic = "force-dynamic";

// Module-scope so `Date` isn't called in the Server Component render body.
function countUpcoming(bks: { status: string; scheduled_start: string | null }[]): number {
  const now = new Date().getTime();
  return bks.filter(
    (b) =>
      (b.status === "confirmed" || b.status === "pending") &&
      b.scheduled_start &&
      new Date(b.scheduled_start).getTime() > now,
  ).length;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-ink-100 bg-white p-4">
      <p className="text-xs uppercase tracking-wide text-ink-400">{label}</p>
      <p className="mt-1 font-display text-xl font-semibold text-ink-900">{value}</p>
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
        .select("status, bio, timezone, comp_rate_cents_per_hour, profiles!tutor_profiles_profile_id_fkey(display_name)")
        .eq("profile_id", tutorId)
        .maybeSingle(),
      supabase!.from("bookings").select("status, scheduled_start").eq("tutor_id", tutorId),
      supabase!.from("tutor_earnings").select("amount_cents, status").eq("tutor_id", tutorId),
      supabase!.from("disputes").select("id").eq("tutor_id", tutorId),
      supabase!.from("tutor_cancellation_requests").select("id, status").eq("tutor_id", tutorId),
      supabase!.from("tutor_availability").select("id").eq("tutor_id", tutorId),
    ]);

  const profile = prof as unknown as {
    status: string;
    bio: string | null;
    timezone: string | null;
    comp_rate_cents_per_hour: number | null;
    profiles: { display_name: string | null } | null;
  } | null;
  const name = profile?.profiles?.display_name ?? tutorId.slice(0, 8);

  const bks = (bookings ?? []) as { status: string; scheduled_start: string | null }[];
  const upcoming = countUpcoming(bks);
  const completed = bks.filter((b) => b.status === "completed").length;
  const cancelled = bks.filter((b) => b.status === "cancelled").length;
  const noShow = bks.filter((b) => b.status === "no_show").length;

  let earned = 0,
    paid = 0,
    outstanding = 0;
  for (const e of (earnings ?? []) as { amount_cents: number; status: string }[]) {
    if (e.status === "voided") continue;
    earned += e.amount_cents;
    if (e.status === "paid") paid += e.amount_cents;
    else outstanding += e.amount_cents;
  }
  const disputeCount = (disputes ?? []).length;
  const availCount = (avail ?? []).length;
  const openRequests = ((reqs ?? []) as { status: string }[]).filter((r) => r.status === "open").length;

  return (
    <div className="min-h-full bg-ink-50/50 py-10">
      <Container className="max-w-4xl">
        <Link href="/dashboard/admin" className="text-sm font-medium text-gold-700 hover:underline">
          ← Back to admin
        </Link>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-3xl font-semibold text-ink-900">{name}</h1>
          <span className="rounded-full border border-ink-200 bg-white px-3 py-1 text-sm capitalize text-ink-700">
            {profile?.status ?? "unknown"}
          </span>
        </div>
        <p className="mt-1 text-sm text-ink-500">
          Timezone: {profile?.timezone ?? "—"} · Rate:{" "}
          {typeof profile?.comp_rate_cents_per_hour === "number"
            ? `${formatCents(profile.comp_rate_cents_per_hour)}/hr`
            : "not set"}
        </p>
        {profile?.bio ? (
          <p className="mt-3 rounded-xl border border-ink-100 bg-white p-4 text-sm text-ink-700">{profile.bio}</p>
        ) : null}

        <h2 className="mt-8 mb-3 text-sm font-semibold tracking-wide text-ink-500 uppercase">Compensation</h2>
        <TutorRateForm tutorId={tutorId} initialRateCents={profile?.comp_rate_cents_per_hour ?? null} />

        <h2 className="mt-8 mb-3 text-sm font-semibold tracking-wide text-ink-500 uppercase">Operations</h2>
        <div className="grid gap-3 sm:grid-cols-4">
          <Stat label="Upcoming" value={String(upcoming)} />
          <Stat label="Completed" value={String(completed)} />
          <Stat label="Cancelled" value={String(cancelled)} />
          <Stat label="No-shows" value={String(noShow)} />
          <Stat label="Earned" value={formatCents(earned)} />
          <Stat label="Paid" value={formatCents(paid)} />
          <Stat label="Outstanding" value={formatCents(outstanding)} />
          <Stat label="Disputes" value={String(disputeCount)} />
          <Stat label="Open cancel requests" value={String(openRequests)} />
        </div>
        <p className="mt-3 text-xs text-ink-400">
          Availability blocks: {availCount} · Operational visibility only (no scoring / automatic action). Guides are
          not assigned by academic subject.
        </p>
      </Container>
    </div>
  );
}
