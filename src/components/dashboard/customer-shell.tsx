"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { BrandLockup } from "@/components/brand/brand-lockup";
import { LogoutButton } from "@/components/dashboard/logout-button";
import { PARENT_NAV_ICONS } from "@/components/dashboard/parent-icons";
import { PARENT_PORTAL_NAV } from "@/lib/parent-portal.mjs";
import { cn } from "@/lib/utils";

/**
 * Parent household application shell. Destinations are real routes, not page anchors.
 */
export function CustomerShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/dashboard/student") {
      return pathname === "/dashboard/student" || pathname.startsWith("/dashboard/student/visual-review");
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <div className="parent-app flex min-h-svh">
      <aside className="sticky top-0 hidden h-svh w-[15.5rem] shrink-0 flex-col border-r border-[#1c1915]/[0.06] bg-[#f3eee4] px-4 py-5 lg:flex">
        <BrandLockup
          href="/dashboard/student"
          variant="product"
          size={26}
          className="shrink-0 px-1.5"
          textClassName="text-[13.5px]"
        />
        <nav className="mt-8 flex min-w-0 flex-col gap-1" aria-label="Parent account">
          {PARENT_PORTAL_NAV.map((item) => {
            const Icon = PARENT_NAV_ICONS[item.label as keyof typeof PARENT_NAV_ICONS];
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(item.href) ? "page" : undefined}
                className={cn(
                  "pp-nav-link inline-flex min-h-11 items-center gap-3 rounded-[12px] px-3 text-[14px] font-medium",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c9a227]",
                  active
                    ? "bg-[#f3e6c4] text-[#5c4310] shadow-[inset_0_0_0_1px_rgba(201,162,39,0.28)]"
                    : "text-[#3d3932] hover:bg-[#ebe4d6] hover:text-[#1c1915]",
                )}
              >
                {Icon ? (
                  <Icon className={active ? "text-[#c9a227]" : "text-[#7a7368]"} />
                ) : null}
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto space-y-2 pt-8">
          <Link
            href="/dashboard/student/book"
            className="pp-interact inline-flex min-h-11 w-full items-center justify-center rounded-[12px] bg-[#c9a227] px-3 text-[13px] font-semibold text-[#1c1915] hover:bg-[#b8921f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c9a227]"
          >
            Book a Study Hall
          </Link>
          <Link
            href="/dashboard/student/plan-week"
            className="inline-flex min-h-11 w-full items-center justify-center rounded-[12px] px-3 text-[13px] font-medium text-[#3d3932] underline-offset-4 hover:bg-[#ebe4d6] hover:text-[#1c1915] hover:underline"
          >
            Plan my week
          </Link>
          <LogoutButton quiet className="w-full justify-center px-2.5 text-[13px]" />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 border-b border-[#1c1915]/[0.06] bg-[#f6f1e8]/92 backdrop-blur lg:hidden">
          <div className="flex h-14 items-center justify-between gap-3 px-4">
            <BrandLockup
              href="/dashboard/student"
              variant="product"
              size={24}
              className="min-w-0 shrink"
              textClassName="text-[13px] sm:text-[14px]"
            />
            <LogoutButton quiet className="shrink-0 px-2.5 text-[13px]" />
          </div>
          <div className="border-t border-[#1c1915]/[0.05]">
            <nav
              aria-label="Parent account"
              className="flex flex-wrap gap-1.5 px-4 py-2.5"
            >
              {PARENT_PORTAL_NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive(item.href) ? "page" : undefined}
                  className={cn(
                    "pp-nav-link inline-flex min-h-11 items-center rounded-full px-3 text-[13px] font-medium",
                    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c9a227]",
                    isActive(item.href)
                      ? "bg-[#f3e6c4] text-[#5c4310] shadow-[inset_0_0_0_1px_rgba(201,162,39,0.28)]"
                      : "bg-white/60 text-[#3d3932]",
                  )}
                >
                  {item.shortLabel}
                </Link>
              ))}
            </nav>
          </div>
        </header>

        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
