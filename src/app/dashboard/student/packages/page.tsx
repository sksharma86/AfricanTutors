import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { PackageStore, type PackageRow } from "@/components/booking/package-store";
import { BalanceCards } from "@/components/dashboard/balance-cards";
import { ParentPage } from "@/components/dashboard/parent-page";
import { ParentSurface } from "@/components/dashboard/parent-surface";
import { SingleSessionCards } from "@/components/dashboard/single-session-cards";
import { requireRole } from "@/lib/auth";
import { formatMoneyCents } from "@/lib/format.mjs";
import { getGuideApplicantInfo } from "@/lib/guide-applicant";
import { parentPaymentPurposeLabel, parentPaymentStatusLabel } from "@/lib/parent-portal.mjs";
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

  const [{ data: packages }, balancesRes, paymentsRes] = await Promise.all([
    supabase!
      .from("package_products")
      .select("id, name, minutes, price_cents")
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

  return (
    <ParentPage wide>
      <h1 className="font-display text-3xl font-semibold tracking-[-0.03em] text-ink-900">Hours</h1>
      <p className="mt-2 text-sm text-ink-500">Hours never expire.</p>

      <ParentSurface className="mt-8">
        <h2 className="text-[11px] font-semibold tracking-[0.14em] text-ink-400 uppercase">Available hours</h2>
        <div className="mt-3">
          <BalanceCards minutes={minutes} creditCents={creditCents} />
        </div>
      </ParentSurface>

      <div className="mt-10">
        <p className="mb-3 text-sm text-ink-600">Pay as you go · $12/hour</p>
        <SingleSessionCards />
      </div>

      <div id="prepaid" className="mt-10 scroll-mt-24">
        <h2 className="text-lg font-semibold tracking-tight text-ink-900">Save with prepaid hours</h2>
        <p className="mt-1 text-sm text-ink-500">
          14 hours / $140 · 28 hours / $252 · as low as $9/hour. Hours never expire.
        </p>
        <div className="mt-4">
          <PackageStore packages={(packages ?? []) as PackageRow[]} creditCents={creditCents} />
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

      <p className="mt-8 text-sm text-ink-500">
        <Link href="/dashboard/student/book" className="font-medium text-gold-700 hover:underline">
          Book a Study Hall
        </Link>
      </p>
    </ParentPage>
  );
}
