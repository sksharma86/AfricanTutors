import type { Metadata } from "next";
import Link from "next/link";

import { ADMIN_PORTAL_NAV } from "@/components/dashboard/dashboard-shell";
import { ManagementPage } from "@/components/dashboard/management-page";
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
    <ManagementPage navItems={ADMIN_PORTAL_NAV} wide>
      <h1 className="font-display text-[1.35rem] font-semibold tracking-[-0.03em] text-[var(--mg-ink)]">Customers</h1>
      <p className="mt-1 text-sm text-[var(--mg-muted)]">Find a parent account without opening the database.</p>
      <div className="mt-4">
      <form className="mb-5 flex flex-col gap-2 sm:flex-row">
        <input
          name="q"
          defaultValue={q}
          placeholder="Parent name, child name, or notified email"
          className="min-h-11 min-w-0 flex-1 rounded-[10px] border border-[#1c1915]/12 bg-[var(--mg-card)] px-3 text-sm"
        />
        <button type="submit" className="min-h-11 rounded-[10px] bg-[#161c18] px-4 text-sm font-medium text-[#f6f1e8]">
          Find
        </button>
      </form>
      {rows.length === 0 ? (
        <p className="text-sm text-[var(--mg-muted)]">No matching parent accounts.</p>
      ) : (
        <ul className="mg-list overflow-hidden px-3.5">
          {rows.map((p) => (
            <li key={p.id} className="flex items-baseline justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <Link href={`/dashboard/admin/customers/${p.id}`} className="text-[13.5px] font-medium text-[var(--mg-ink)] hover:underline">
                  {p.display_name ?? "Parent"}
                </Link>
                <p className="mt-0.5 text-[13px] text-[var(--mg-muted)]">
                  {(childrenByAccount.get(p.id) ?? []).join(", ") || "No children on file"}
                </p>
              </div>
              <span className="shrink-0 text-[13px] text-[var(--mg-muted)]" aria-hidden>
                ›
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-8 text-xs text-[var(--mg-muted)]">
        Email search uses notification history only. Auth emails are not on profiles, and there is no safe admin email
        index — a parent who has never been emailed can be found by name. Detail still shows the authorized auth email.
      </p>
      </div>
    </ManagementPage>
  );
}
