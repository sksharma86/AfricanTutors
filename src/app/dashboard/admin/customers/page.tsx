import type { Metadata } from "next";
import Link from "next/link";

import { ADMIN_PORTAL_NAV, DashboardShell } from "@/components/dashboard/dashboard-shell";
import { requireRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Customers · Management" };
export const dynamic = "force-dynamic";

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireRole("admin", "/dashboard/admin/customers");
  const { q = "" } = await searchParams;
  const supabase = await createSupabaseServerClient();

  const [{ data: students }, { data: tutorRows }, { data: deliveries }] = await Promise.all([
    supabase!.from("students").select("id, account_id, full_name"),
    supabase!.from("tutor_profiles").select("profile_id"),
    q.includes("@")
      ? supabase!.from("email_deliveries").select("recipient_account_id, to_email").ilike("to_email", `%${q.trim()}%`).limit(20)
      : Promise.resolve({ data: [] }),
  ]);

  const guideIds = new Set(((tutorRows ?? []) as { profile_id: string }[]).map((t) => t.profile_id));
  const accountIds = new Set<string>();
  const childrenByAccount = new Map<string, string[]>();
  for (const s of (students ?? []) as { account_id: string; full_name: string }[]) {
    accountIds.add(s.account_id);
    const list = childrenByAccount.get(s.account_id) ?? [];
    list.push(s.full_name);
    childrenByAccount.set(s.account_id, list);
  }

  const extraFromEmail = ((deliveries ?? []) as { recipient_account_id: string | null }[])
    .map((d) => d.recipient_account_id)
    .filter((id): id is string => Boolean(id));
  for (const id of extraFromEmail) accountIds.add(id);

  const ids = [...accountIds].filter((id) => !guideIds.has(id));
  const { data: profiles } = ids.length
    ? await supabase!.from("profiles").select("id, display_name, role").in("id", ids)
    : { data: [] };

  const query = q.trim().toLowerCase();
  const rows = ((profiles ?? []) as { id: string; display_name: string | null; role: string }[])
    .filter((p) => p.role === "student")
    .filter((p) => {
      if (!query) return true;
      const kids = (childrenByAccount.get(p.id) ?? []).join(" ").toLowerCase();
      const name = (p.display_name ?? "").toLowerCase();
      if (name.includes(query) || kids.includes(query)) return true;
      if (query.includes("@")) return extraFromEmail.includes(p.id);
      return false;
    })
    .sort((a, b) => (a.display_name ?? "").localeCompare(b.display_name ?? ""));

  return (
    <DashboardShell
      role="admin"
      title="Customers"
      description="Find a parent account without opening the database."
      navItems={ADMIN_PORTAL_NAV}
    >
      <form className="mb-6 flex flex-col gap-2 sm:flex-row">
        <input
          name="q"
          defaultValue={q}
          placeholder="Parent name, child name, or notified email"
          className="min-w-0 flex-1 rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm outline-none focus:border-ink-400"
        />
        <button type="submit" className="rounded-lg bg-ink-900 px-3 py-2 text-sm font-medium text-white">
          Find
        </button>
      </form>
      {rows.length === 0 ? (
        <p className="text-sm text-ink-500">No matching parent accounts.</p>
      ) : (
        <ul className="divide-y divide-ink-100">
          {rows.map((p) => (
            <li key={p.id} className="py-3">
              <Link href={`/dashboard/admin/customers/${p.id}`} className="text-sm font-medium text-ink-900 hover:underline">
                {p.display_name ?? "Parent"}
              </Link>
              <p className="mt-0.5 text-sm text-ink-500">
                {(childrenByAccount.get(p.id) ?? []).join(", ") || "No children on file"}
              </p>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-8 text-xs text-ink-400">
        Email search uses notification history only. Auth emails are not on profiles, and there is no safe admin email
        index — a parent who has never been emailed can be found by name. Detail still shows the authorized auth email.
      </p>
    </DashboardShell>
  );
}
