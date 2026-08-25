import type { ReactNode } from "react";

import { LogoutButton } from "@/components/dashboard/logout-button";
import { Container } from "@/components/ui/container";
import { Badge } from "@/components/ui/badge";
import type { Role } from "@/lib/roles";

const ROLE_LABEL: Record<Role, string> = {
  student: "Parent",
  tutor: "Guide",
  admin: "Manager",
};

export interface DashboardNavItem {
  label: string;
  available: boolean;
}

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
    <div className="min-h-full bg-ink-50/50">
      <div className="border-b border-ink-100 bg-white">
        <Container className="flex items-center justify-between py-5">
          <div>
            <Badge>{badgeLabel ?? `${ROLE_LABEL[role]} Dashboard`}</Badge>
            <h1 className="mt-2 font-display text-2xl font-semibold text-ink-900">{title}</h1>
            <p className="mt-1 text-sm text-ink-500">{description}</p>
          </div>
          <LogoutButton />
        </Container>
      </div>

      <Container className="grid gap-8 py-10 lg:grid-cols-[220px_1fr]">
        <nav className="space-y-1">
          {navItems.map((item) => (
            <div
              key={item.label}
              className={`flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium ${
                item.available
                  ? "bg-ink-900 text-white"
                  : "text-ink-400"
              }`}
            >
              <span>{item.label}</span>
              {!item.available ? (
                <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-ink-500 uppercase">
                  Soon
                </span>
              ) : null}
            </div>
          ))}
        </nav>

        <div>{children}</div>
      </Container>
    </div>
  );
}
