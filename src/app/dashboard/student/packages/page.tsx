import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { PackageStore, type PackageRow } from "@/components/booking/package-store";
import { CustomerShell } from "@/components/dashboard/customer-shell";
import { SingleSessionCards } from "@/components/dashboard/single-session-cards";
import { requireRole } from "@/lib/auth";
import { formatDuration, formatMoneyCents } from "@/lib/format.mjs";
import { getGuideApplicantInfo } from "@/lib/guide-applicant";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Pricing",
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

  const [{ data: packages }, balancesRes] = await Promise.all([
    supabase!
      .from("package_products")
      .select("id, name, minutes, price_cents")
      .eq("is_active", true)
      .order("sort_order"),
    uid ? supabase!.rpc("get_customer_balances", { p_account: uid }) : Promise.resolve({ data: null }),
  ]);

  const balances = (balancesRes.data ?? {}) as { package_minutes?: number; dollar_credit_cents?: number };
  const minutes = balances.package_minutes ?? 0;
  const creditCents = balances.dollar_credit_cents ?? 0;

  return (
    <CustomerShell>
      <div className="mx-auto w-full max-w-4xl px-5 py-8 sm:px-6 sm:py-10 lg:px-8">
        <Link href="/dashboard/student" className="text-sm font-medium text-ink-600 hover:text-ink-900 hover:underline">
          ← Back to dashboard
        </Link>
        <h1 className="mt-3 font-display text-3xl font-medium text-ink-900 sm:text-4xl">
          Study Hall hours
        </h1>
        <p className="mt-2 max-w-xl text-base leading-7 text-ink-500">
          Book one session at a time, or save with prepaid hours. Prepaid hours never expire.
        </p>

        {creditCents > 0 || minutes > 0 ? (
          <div className="mt-5 flex flex-wrap gap-3 text-sm">
            {minutes > 0 ? (
              <span className="rounded-full border border-ink-200 bg-white px-3.5 py-1.5 text-ink-700">
                Prepaid Hours: <span className="font-semibold text-ink-900">{formatDuration(minutes)}</span>
              </span>
            ) : null}
            {creditCents > 0 ? (
              <span className="rounded-full border border-ink-200 bg-white px-3.5 py-1.5 text-ink-700">
                Account credit: <span className="font-semibold text-ink-900">{formatMoneyCents(creditCents)}</span>{" "}
                <span className="text-ink-400">· applied at checkout</span>
              </span>
            ) : null}
          </div>
        ) : null}

        <div className="mt-8">
          <SingleSessionCards />
        </div>

        <div id="prepaid" className="mt-10 scroll-mt-24">
          <h2 className="text-lg font-semibold tracking-tight text-ink-900">Save with prepaid hours</h2>
          <p className="mt-1 text-sm text-ink-500">
            Built for a consistent Study Hall routine. Hours never expire.
          </p>
          <div className="mt-4">
            <PackageStore packages={(packages ?? []) as PackageRow[]} creditCents={creditCents} />
          </div>
        </div>
      </div>
    </CustomerShell>
  );
}
