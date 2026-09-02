import type { ReactNode } from "react";

import {
  DashboardSideNav,
  type DashboardNavItem,
} from "@/components/dashboard/dashboard-side-nav";
import { LogoutButton } from "@/components/dashboard/logout-button";
import { Container } from "@/components/ui/container";
import { Badge } from "@/components/ui/badge";
import type { Role } from "@/lib/roles";

export type { DashboardNavItem };

const ROLE_LABEL: Record<Role, string> = {
  student: "Parent",
  tutor: "Guide",
  admin: "Manager",
};

export function DashboardShell({
  role,
  title,
  description,
  navItems,
  children,
  badgeLabel,
}: {
  role: Role;
  title: string;
  description?: string;
  navItems: DashboardNavItem[];
  children: ReactNode;
  /** Override the default "{Role} Dashboard" badge (e.g. Guide applicant). */
  badgeLabel?: string;
}) {
  return (
    <div className="min-h-full bg-[#f4f5f7]">
      <div className="border-b border-ink-100 bg-white">
        <Container className="flex items-center justify-between gap-4 py-5">
          <div className="min-w-0">
            <Badge>{badgeLabel ?? `${ROLE_LABEL[role]} Dashboard`}</Badge>
            <h1 className="mt-2 font-display text-2xl font-semibold text-ink-900">{title}</h1>
            {description ? <p className="mt-1 text-sm text-ink-500">{description}</p> : null}
          </div>
          <LogoutButton />
        </Container>
      </div>

      <Container className="grid gap-6 py-8 sm:gap-8 sm:py-10 lg:grid-cols-[220px_1fr]">
        <aside className="min-w-0 lg:sticky lg:top-4 lg:self-start">
          <DashboardSideNav items={navItems} />
        </aside>

        <div className={role === "admin" ? "min-w-0 max-w-4xl" : "min-w-0"}>{children}</div>
      </Container>
    </div>
  );
}

/** Shared Management portal destinations — real routes, not page anchors. */
export const ADMIN_PORTAL_NAV: DashboardNavItem[] = [
  { label: "Overview", href: "/dashboard/admin" },
  { label: "Study Halls", href: "/dashboard/admin/study-halls" },
  { label: "Incident History", href: "/dashboard/admin/incidents" },
  { label: "Guides", href: "/dashboard/admin/guides" },
  { label: "Customers", href: "/dashboard/admin/customers" },
  { label: "Finance", href: "/dashboard/admin/finance" },
];

/** Shared Guide workstation destinations — real routes. */
export { GUIDE_PORTAL_NAV } from "@/lib/guide-portal.mjs";
