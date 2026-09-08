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
import { parseParentMembership } from "@/lib/parent-week.mjs";
import { customerFacingPrepaidPackages } from "@/lib/study-hall-365/catalog.mjs";
import { parseOpenMembershipFlag } from "@/lib/study-hall-365/hours-ctas.mjs";
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

  const [{ data: packages }, balancesRes, paymentsRes, membershipRes, openMembershipRes] = await Promise.all([
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
    uid
      ? supabase!
          .rpc("study_hall_365_has_open_membership", { p_account: uid })
          .then((r) => r, () => ({ data: null, error: { message: "open_membership_rpc_failed" } }))
      : Promise.resolve({ data: null, error: { message: "no_account" } }),
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
  const membershipParsed = parseParentMembership(membershipRes && "data" in membershipRes ? membershipRes.data : null);
  const entitled365 = Boolean(membershipParsed?.entitled);
  const membership = membershipParsed
    ? {
        status: membershipParsed.customerStatus,
        entitled: membershipParsed.entitled,
        cancelAtPeriodEnd: membershipParsed.cancelAtPeriodEnd,
        periodEnd: membershipParsed.periodEnd ?? "",
      }
    : null;
  const openMembership = parseOpenMembershipFlag(openMembershipRes);

  return (
    <ParentPage wide>
      <h1 className="font-display text-3xl font-semibold tracking-[-0.035em] text-[var(--pp-ink)]">Hours</h1>
      <p className="mt-2 text-sm text-[var(--pp-muted)]">
        {entitled365
          ? "Your household uses Study Hall 365 for one Study Hall each day. Prepaid hours are optional for an extra same-day session."
          : "How your household funds Study Hall. Hours never expire."}
      </p>

      {entitled365 ? (
        <ParentSurface className="mt-8">
          <h2 className="text-[11px] font-semibold tracking-[0.14em] text-[var(--pp-muted)] uppercase">Study Hall 365</h2>
          <p className="mt-2 text-sm font-medium text-[var(--pp-ink)]">Active · one Study Hall per day</p>
          {membership?.cancelAtPeriodEnd && membership.periodEnd ? (
            <p className="mt-1 text-sm text-[var(--pp-muted)]">
              Access continues through the paid period.
            </p>
          ) : (
            <p className="mt-1 text-sm text-[var(--pp-muted)]">
              Daily membership covers your regular Study Hall. You do not need prepaid hours for that.
            </p>
          )}
        </ParentSurface>
      ) : (
        <ParentSurface className="mt-8">
          <h2 className="text-[11px] font-semibold tracking-[0.14em] text-[var(--pp-muted)] uppercase">Available hours</h2>
          <div className="mt-3">
            <BalanceCards minutes={minutes} creditCents={creditCents} />
          </div>
        </ParentSurface>
      )}

      <div id="study-hall-365" className={`pp-commerce scroll-mt-24 ${entitled365 ? "mt-8" : "mt-10"}`}>
        <h2 className="text-lg font-semibold tracking-tight text-[var(--pp-ink)]">Study Hall 365</h2>
        <p className="mt-1 text-sm text-[var(--pp-muted)]">
          $149/month. One Study Hall each local calendar day. Cancel anytime — access continues through the paid period.
        </p>
        <div className="mt-4 max-w-md">
          <StudyHall365Card membership={membership} openMembership={openMembership} />
        </div>
      </div>

      <div className="pp-commerce mt-10">
        <p className="mb-3 text-sm text-[var(--pp-muted)]">Pay as you go · $12 for one 60-minute Study Hall</p>
        <SingleSessionCards />
      </div>

      <div id="prepaid" className="pp-commerce mt-10 scroll-mt-24">
        <h2 className="text-lg font-semibold tracking-tight text-[var(--pp-ink)]">
          {entitled365 ? "Extra same-day Study Halls" : "Save with prepaid hours"}
        </h2>
        <p className="mt-1 text-sm text-[var(--pp-muted)]">
          {entitled365
            ? "10 Study Halls / $100 · $10 each. Useful if you want a second Study Hall on the same day. Purchased Study Halls never expire."
            : "10 Study Halls / $100 · $10 each. Purchased Study Halls never expire."}
        </p>
        {entitled365 && minutes === 0 ? (
          <p className="mt-3 text-sm text-[var(--pp-muted)]">
            No prepaid Study Halls on file — that’s expected for ordinary daily membership use.
          </p>
        ) : entitled365 ? (
          <div className="mt-4">
            <BalanceCards minutes={minutes} creditCents={creditCents} showBuyHours={false} />
          </div>
        ) : null}
        <div className="mt-4">
          <PackageStore packages={offerPackages} creditCents={creditCents} />
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

      <p className="mt-8 flex flex-wrap gap-3">
        <LinkButton href="/dashboard/student/plan-week" variant="primary" size="sm">
          Plan my week
        </LinkButton>
        <LinkButton href="/dashboard/student/book" variant="outline" size="sm">
          Book a Study Hall
        </LinkButton>
      </p>
    </ParentPage>
  );
}
