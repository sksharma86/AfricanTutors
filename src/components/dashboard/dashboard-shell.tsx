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
  description: string;
  navItems: DashboardNavItem[];
  children: ReactNode;
  /** Override the default "{Role} Dashboard" badge (e.g. Guide applicant). */
  badgeLabel?: string;
}) {
  return (
    <div className="min-h-full bg-[color:var(--background)]">
      <div className="border-b border-ink-100/80 bg-surface">
        <Container className="flex items-center justify-between gap-4 py-5">
          <div className="min-w-0">
            <Badge>{badgeLabel ?? `${ROLE_LABEL[role]} Dashboard`}</Badge>
            <h1 className="mt-2 font-display text-3xl font-medium text-ink-900">{title}</h1>
            <p className="mt-1 text-sm text-ink-500">{description}</p>
          </div>
          <LogoutButton />
        </Container>
      </div>

      <Container className="grid gap-6 py-8 sm:gap-8 sm:py-10 lg:grid-cols-[220px_1fr]">
        <aside className="min-w-0 lg:sticky lg:top-4 lg:self-start">
          <DashboardSideNav items={navItems} />
        </aside>

        <div className="min-w-0">{children}</div>
      </Container>
    </div>
  );
}

/** Shared Management portal destinations (admin + finance). */
export const ADMIN_PORTAL_NAV: DashboardNavItem[] = [
  { label: "Overview", href: "/dashboard/admin#overview" },
  { label: "Guide Approvals", href: "/dashboard/admin#guide-approvals" },
  { label: "Sessions", href: "/dashboard/admin#sessions" },
  { label: "Finance", href: "/dashboard/admin/finance" },
];

/** Shared Guide workspace destinations. */
export const GUIDE_PORTAL_NAV: DashboardNavItem[] = [
  { label: "Study Halls", href: "/dashboard/tutor#study-halls" },
  { label: "Earnings", href: "/dashboard/tutor#earnings" },
  { label: "Availability", href: "/dashboard/tutor#availability" },
];
