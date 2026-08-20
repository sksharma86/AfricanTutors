import type { Metadata } from "next";
import Link from "next/link";

import { PackageStore, type PackageRow } from "@/components/booking/package-store";
import { CustomerShell } from "@/components/dashboard/customer-shell";
import { requireRole } from "@/lib/auth";
import { formatDuration, formatMoneyCents } from "@/lib/format.mjs";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Packages",
};

export default async function PackagesPage() {
  await requireRole("student", "/dashboard/student/packages");
  const supabase = await createSupabaseServerClient();

  const { data: user } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  const uid = user?.user?.id ?? null;

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
      <div className="mx-auto w-full max-w-4xl px-6 py-10 lg:px-8">
        <Link href="/dashboard/student" className="text-sm font-medium text-gold-700 hover:underline">
          ← Back to dashboard
        </Link>
        <h1 className="mt-3 font-display text-3xl font-semibold text-ink-900 sm:text-4xl">Tutoring packages</h1>
        <p className="mt-2 max-w-xl text-base leading-7 text-ink-500">
          Prepay for tutoring and save on every hour. Package hours never expire and are used automatically when
          they fully cover a session.
        </p>

        {creditCents > 0 || minutes > 0 ? (
          <div className="mt-5 flex flex-wrap gap-3 text-sm">
            {minutes > 0 ? (
              <span className="rounded-full border border-ink-200 bg-white px-3.5 py-1.5 text-ink-700">
                Tutoring balance: <span className="font-semibold text-ink-900">{formatDuration(minutes)}</span>
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
          <PackageStore packages={(packages ?? []) as PackageRow[]} creditCents={creditCents} />
        </div>
      </div>
    </CustomerShell>
  );
}
