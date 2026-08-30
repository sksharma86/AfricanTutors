import type { ReactNode } from "react";

import { ADMIN_PORTAL_NAV, type DashboardNavItem } from "@/components/dashboard/dashboard-shell";
import { ManagementShell } from "@/components/dashboard/management-shell";
import { cn } from "@/lib/utils";

export function ManagementPage({
  children,
  navItems = ADMIN_PORTAL_NAV,
  compose = false,
  wide = false,
}: {
  children: ReactNode;
  navItems?: DashboardNavItem[];
  compose?: boolean;
  wide?: boolean;
}) {
  return (
    <ManagementShell navItems={navItems}>
      <div
        className={cn(
          "mx-auto w-full px-4 py-4 sm:px-5 sm:py-5",
          compose ? "max-w-none" : wide ? "max-w-5xl" : "max-w-4xl",
        )}
      >
        {children}
      </div>
    </ManagementShell>
  );
}
