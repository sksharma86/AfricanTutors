"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";

import { BrandLockup } from "@/components/brand/brand-lockup";
import { MGMT_NAV_ICONS } from "@/components/dashboard/management-icons";
import { LogoutButton } from "@/components/dashboard/logout-button";
import { ADMIN_PORTAL_NAV, type DashboardNavItem } from "@/components/dashboard/dashboard-shell";
import { cn } from "@/lib/utils";

function isActivePath(pathname: string, href: string) {
  if (href === "/dashboard/admin") {
    return pathname === "/dashboard/admin" || pathname.startsWith("/dashboard/admin/visual-review");
  }
  if (href === "/dashboard/admin/guides") {
    return (
      pathname === href ||
      pathname.startsWith("/dashboard/admin/guides/") ||
      pathname.startsWith("/dashboard/admin/tutors/")
    );
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Management control-tower shell. Destinations are real routes.
 * Scoped to .management-app — does not wrap Parent or Guide.
 */
export function ManagementShell({
  children,
  navItems = ADMIN_PORTAL_NAV,
}: {
  children: ReactNode;
  navItems?: DashboardNavItem[];
}) {
  const pathname = usePathname();
  const mobileNavRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const active = mobileNavRef.current?.querySelector<HTMLElement>('[aria-current="page"]');
    active?.scrollIntoView({
      inline: "center",
      block: "nearest",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  }, [pathname]);

  return (
    <div className="management-app flex min-h-svh">
      <aside className="sticky top-0 hidden h-svh w-[15rem] shrink-0 flex-col border-r border-[#1c1915]/[0.07] bg-[#f3eee4] px-3.5 py-5 lg:flex">
        <BrandLockup
          href="/dashboard/admin"
          variant="product"
          size={26}
          className="shrink-0 px-1.5"
          textClassName="text-[13.5px]"
        />
        <p className="mt-7 px-3 text-[10px] font-semibold tracking-[0.16em] text-[#8a8174] uppercase">Management</p>
        <nav className="mt-2 flex min-w-0 flex-col gap-0.5" aria-label="Management">
          {navItems.map((item) => {
            const Icon = MGMT_NAV_ICONS[item.label as keyof typeof MGMT_NAV_ICONS];
            const active = isActivePath(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "mg-nav-link inline-flex min-h-10 items-center gap-3 rounded-[10px] px-3 text-[13.5px] font-medium",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c9a227]",
                  active
                    ? "bg-[#f3e6c4] text-[#5c4310] shadow-[inset_0_0_0_1px_rgba(201,162,39,0.28)]"
                    : "text-[#3d3932] hover:bg-[#ebe4d6] hover:text-[#1c1915]",
                )}
              >
                {Icon ? <Icon className={active ? "text-[#c9a227]" : "text-[#7a7368]"} /> : null}
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto pt-8">
          <LogoutButton quiet className="w-full justify-center px-2.5 text-[13px]" />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 border-b border-[#1c1915]/[0.06] bg-[#f6f1e8]/92 backdrop-blur lg:hidden">
          <div className="flex h-14 items-center justify-between gap-3 px-4">
            <BrandLockup
              href="/dashboard/admin"
              variant="product"
              size={24}
              className="shrink-0"
              textClassName="text-[13px] sm:text-[14px]"
            />
            <LogoutButton quiet className="px-2.5 text-[13px]" />
          </div>
          <div className="relative border-t border-[#1c1915]/[0.05]">
            <nav
              ref={mobileNavRef}
              aria-label="Management"
              className="flex flex-nowrap gap-1.5 overflow-x-auto overscroll-x-contain px-4 py-2.5 pr-10 snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActivePath(pathname, item.href) ? "page" : undefined}
                  className={cn(
                    "mg-nav-link inline-flex min-h-10 shrink-0 snap-start items-center whitespace-nowrap rounded-full px-3.5 text-[13px] font-medium",
                    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c9a227]",
                    isActivePath(pathname, item.href)
                      ? "bg-[#f3e6c4] text-[#5c4310] shadow-[inset_0_0_0_1px_rgba(201,162,39,0.28)]"
                      : "bg-white/60 text-[#3d3932]",
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-[#f6f1e8] to-transparent"
            />
          </div>
        </header>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
