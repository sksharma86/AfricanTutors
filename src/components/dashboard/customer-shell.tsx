"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode } from "react";

import { BrandLockup } from "@/components/brand/brand-lockup";
import { LogoutButton } from "@/components/dashboard/logout-button";
import { Container } from "@/components/ui/container";
import { PARENT_PORTAL_NAV } from "@/lib/parent-portal.mjs";
import { cn } from "@/lib/utils";

/**
 * Parent household shell. Destinations are real routes, not page anchors.
 */
export function CustomerShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/dashboard/student") return pathname === "/dashboard/student";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <div className="flex min-h-full flex-col bg-[#f4f5f7]">
      <header className="sticky top-0 z-40 border-b border-ink-100 bg-white/90 backdrop-blur">
        <Container className="flex h-14 items-center justify-between gap-4 sm:h-16">
          <BrandLockup href="/dashboard/student" variant="product" />
          <nav className="hidden items-center gap-1 md:flex" aria-label="Parent account">
            {PARENT_PORTAL_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(item.href) ? "page" : undefined}
                className={cn(
                  "whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                  isActive(item.href) ? "bg-ink-900 text-white" : "text-ink-600 hover:bg-ink-50 hover:text-ink-900",
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/student/book"
              className="text-sm font-medium text-ink-600 hover:text-ink-900"
            >
              <span className="md:hidden">Book</span>
              <span className="hidden md:inline">Book a Study Hall</span>
            </Link>
            <LogoutButton />
          </div>
        </Container>
        <div className="border-t border-ink-100 md:hidden">
          <nav
            aria-label="Parent account"
            className="flex gap-1 overflow-x-auto overscroll-x-contain px-4 py-2 snap-x snap-mandatory"
          >
            {PARENT_PORTAL_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(item.href) ? "page" : undefined}
                className={cn(
                  "shrink-0 snap-start whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] font-medium",
                  isActive(item.href) ? "bg-ink-900 text-white" : "text-ink-600",
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>
    </div>
  );
}
