import { ManagementPage } from "@/components/dashboard/management-page";
import { ManagementSurface } from "@/components/dashboard/management-surface";
import { ADMIN_PORTAL_NAV } from "@/components/dashboard/dashboard-shell";

/**
 * Presentational Management directories for film. Fixture names only. No approve/payout actions.
 */
export function FilmGuides() {
  const guides = [
    { name: "Sarah M.", note: "Active · Weekly hours set · 3 upcoming" },
    { name: "Faith N.", note: "Active · Weekly hours set · 2 upcoming" },
    { name: "Grace K.", note: "Active · Weekly hours set · 1 upcoming" },
    { name: "James O.", note: "Active · Weekly hours set · 2 upcoming" },
  ];
  return (
    <ManagementPage navItems={ADMIN_PORTAL_NAV} wide>
      <h1 className="font-display text-[1.35rem] font-semibold tracking-[-0.03em] text-[var(--mg-ink)]">Guides</h1>
      <p className="mt-1 text-sm text-[var(--mg-muted)]">Approved people who show up for Study Hall.</p>
      <p className="mt-4 text-[13px] text-[var(--mg-muted)]">
        <strong className="font-semibold text-[var(--mg-ink)]">4</strong> active
        <span className="mx-3">·</span>
        <strong className="font-semibold text-[var(--mg-ink)]">2</strong> applications
      </p>
      <ManagementSurface className="mt-4">
        <p className="text-[10px] font-semibold tracking-[0.14em] text-[var(--mg-muted)] uppercase">Active Guides</p>
        <ul className="mt-2">
          {guides.map((g) => (
            <li key={g.name} className="border-t border-[#ece6d8] py-3 first:border-t-0">
              <p className="text-[13.5px] font-medium text-[var(--mg-ink)]">{g.name}</p>
              <p className="mt-0.5 text-[13px] text-[var(--mg-muted)]">{g.note}</p>
            </li>
          ))}
        </ul>
      </ManagementSurface>
    </ManagementPage>
  );
}

export function FilmCustomers() {
  const households = [
    { parent: "Priya", children: "Jordan" },
    { parent: "Elena", children: "Maya" },
    { parent: "David", children: "Ethan" },
    { parent: "Amara", children: "Noah" },
  ];
  return (
    <ManagementPage navItems={ADMIN_PORTAL_NAV} wide>
      <h1 className="font-display text-[1.35rem] font-semibold tracking-[-0.03em] text-[var(--mg-ink)]">Customers</h1>
      <p className="mt-1 text-sm text-[var(--mg-muted)]">Parent households. Names are film fixtures.</p>
      <ManagementSurface className="mt-4">
        <ul>
          {households.map((h) => (
            <li key={h.parent} className="flex items-baseline justify-between gap-3 border-t border-[#ece6d8] py-2.5 first:border-t-0">
              <div>
                <p className="text-[13.5px] font-medium text-[var(--mg-ink)]">{h.parent}</p>
                <p className="mt-0.5 text-[13px] text-[var(--mg-muted)]">{h.children}</p>
              </div>
            </li>
          ))}
        </ul>
      </ManagementSurface>
    </ManagementPage>
  );
}
