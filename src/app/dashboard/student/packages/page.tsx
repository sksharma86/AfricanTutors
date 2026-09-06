import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PackageStore, type PackageRow } from "@/components/booking/package-store";
import { StudyHall365Card } from "@/components/booking/study-hall-365-card";
import { LinkButton } from "@/components/ui/button";
import { BalanceCards } from "@/components/dashboard/balance-cards";
import { ParentPage } from "@/components/dashboard/parent-page";
import { ParentSurface } from "@/components/dashboard/parent-surface";
import { SingleSessionCards } from "@/components/dashboard/single-session-cards";
import { requireRole } from "@/lib/auth";
import { formatMoneyCents } from "@/lib/format.mjs";
import { getGuideApplicantInfo } from "@/lib/guide-applicant";
import { parentPaymentPurposeLabel, parentPaymentStatusLabel } from "@/lib/parent-portal.mjs";
import { customerFacingPrepaidPackages } from "@/lib/study-hall-365/catalog.mjs";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Hours",
};

export default async function PackagesPage() {
  const user = await requireRole("student", "/dashboard/student/packages");
  const applicant = await getGuideApplicantInfo(user.id);
  if (applicant) {
    redirect("/dashboard/applicant");
  }
  const supabase = await createSupabaseServerClient();

  const { data: authUser } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  const uid = authUser?.user?.id ?? null;

  const [{ data: packages }, balancesRes, paymentsRes, membershipRes] = await Promise.all([
    supabase!
      .from("package_products")
      .select("id, code, name, minutes, price_cents")
      .eq("is_active", true)
      .order("sort_order"),
    uid ? supabase!.rpc("get_customer_balances", { p_account: uid }) : Promise.resolve({ data: null }),
    uid
      ? supabase!
          .from("payments")
          .select("id, purpose, status, stripe_paid_cents, created_at")
          .eq("account_id", uid)
          .order("created_at", { ascending: false })
          .limit(12)
          .then((r) => r, () => ({ data: null, error: null }))
      : Promise.resolve({ data: null }),
    uid
      ? supabase!
          .rpc("get_study_hall_365_membership", { p_account: uid })
          .then((r) => r, () => ({ data: null, error: null }))
      : Promise.resolve({ data: null }),
  ]);

  const balances = (balancesRes.data ?? {}) as { package_minutes?: number; dollar_credit_cents?: number };
  const minutes = balances.package_minutes ?? 0;
  const creditCents = balances.dollar_credit_cents ?? 0;
  const payments = (paymentsRes.data ?? []) as {
    id: string;
    purpose: string;
    status: string;
    stripe_paid_cents: number;
    created_at: string;
  }[];
  const offerPackages = customerFacingPrepaidPackages((packages ?? []) as PackageRow[]);
  const membershipPayload = membershipRes && "data" in membershipRes ? membershipRes.data : null;
  const mem =
    membershipPayload && typeof membershipPayload === "object" && "membership" in membershipPayload
      ? (membershipPayload as { membership: Record<string, unknown> | null }).membership
      : membershipPayload && typeof membershipPayload === "object" && "entitled" in (membershipPayload as object)
        ? (membershipPayload as Record<string, unknown>)
        : null;
  const membership = mem
    ? {
        status: String(mem.customer_status ?? (mem.entitled ? "active" : "inactive")),
        entitled: Boolean(mem.entitled),
        cancelAtPeriodEnd: Boolean(mem.cancel_at_period_end),
        periodEnd: String(mem.current_period_end ?? ""),
      }
    : null;

  return (
    <ParentPage wide>
      <h1 className="font-display text-3xl font-semibold tracking-[-0.035em] text-[var(--pp-ink)]">Hours</h1>
      <p className="mt-2 text-sm text-[var(--pp-muted)]">Pricing &amp; Study Hall options. Hours never expire.</p>

      <ParentSurface className="mt-8">
        <h2 className="text-[11px] font-semibold tracking-[0.14em] text-[var(--pp-muted)] uppercase">Available hours</h2>
        <div className="mt-3">
          <BalanceCards minutes={minutes} creditCents={creditCents} />
        </div>
      </ParentSurface>

      <div className="pp-commerce mt-10">
        <p className="mb-3 text-sm text-[var(--pp-muted)]">Pay as you go · $12/hour</p>
        <SingleSessionCards />
      </div>

      <div id="prepaid" className="pp-commerce mt-10 scroll-mt-24">
        <h2 className="text-lg font-semibold tracking-tight text-[var(--pp-ink)]">Save with prepaid hours</h2>
        <p className="mt-1 text-sm text-[var(--pp-muted)]">
          10 Study Halls / $100 · $10 each. Purchased Study Halls never expire.
        </p>
        <div className="mt-4">
          <PackageStore packages={offerPackages} creditCents={creditCents} />
        </div>
      </div>

      <div id="study-hall-365" className="pp-commerce mt-10 scroll-mt-24">
        <h2 className="text-lg font-semibold tracking-tight text-[var(--pp-ink)]">Study Hall 365</h2>
        <p className="mt-1 text-sm text-[var(--pp-muted)]">
          $149/month. One Study Hall each local calendar day. Cancel anytime — access continues through the paid period.
        </p>
        <div className="mt-4 max-w-md">
          <StudyHall365Card membership={membership} />
        </div>
      </div>

      {payments.length > 0 ? (
        <section className="mt-12 border-t border-ink-100 pt-6">
          <h2 className="text-sm font-semibold tracking-wide text-ink-400 uppercase">Recent purchases</h2>
          <ul className="mt-3 divide-y divide-ink-100 text-sm">
            {payments.map((p) => (
              <li key={p.id} className="flex justify-between gap-3 py-2">
                <span className="text-ink-700">{parentPaymentPurposeLabel(p.purpose)}</span>
                <span className="text-ink-500">
                  {p.status === "succeeded" || p.status === "paid"
                    ? formatMoneyCents(p.stripe_paid_cents)
                    : parentPaymentStatusLabel(p.status)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="mt-8">
        <LinkButton href="/dashboard/student/book" variant="outline" size="sm">
          Book a Study Hall
        </LinkButton>
      </p>
    </ParentPage>
  );
}
