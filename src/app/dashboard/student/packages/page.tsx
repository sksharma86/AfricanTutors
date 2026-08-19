import type { Metadata } from "next";
import Link from "next/link";

import { PackageStore, type PackageRow } from "@/components/booking/package-store";
import { Container } from "@/components/ui/container";
import { requireRole } from "@/lib/auth";
import { formatCents } from "@/lib/pricing";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Tutoring Packages",
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
    <div className="min-h-full bg-ink-50/50 py-10">
      <Container className="max-w-3xl">
        <Link href="/dashboard/student" className="text-sm font-medium text-gold-700 hover:underline">
          ← Back to dashboard
        </Link>
        <h1 className="mt-3 font-display text-3xl font-semibold text-ink-900">Tutoring packages</h1>
        <p className="mt-1 text-sm text-ink-500">
          Buy tutoring minutes in advance and save. Package minutes never expire and are used automatically when they
          fully cover a session.
        </p>

        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <span className="rounded-full border border-ink-200 bg-white px-3 py-1 text-ink-700">
            Balance: <span className="font-medium text-ink-900">{minutes} minutes</span>
          </span>
          <span className="rounded-full border border-ink-200 bg-white px-3 py-1 text-ink-700">
            Account credit: <span className="font-medium text-ink-900">{formatCents(creditCents)}</span>
          </span>
        </div>

        <div className="mt-8">
          <PackageStore packages={(packages ?? []) as PackageRow[]} creditCents={creditCents} />
        </div>
      </Container>
    </div>
  );
}
