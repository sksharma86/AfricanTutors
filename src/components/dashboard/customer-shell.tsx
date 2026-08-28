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
        <Container
          size="wide"
          className="flex h-14 flex-nowrap items-center justify-between gap-3 lg:h-[3.25rem] lg:gap-4"
        >
          <BrandLockup
            href="/dashboard/student"
            variant="product"
            size={24}
            className="shrink-0"
            textClassName="text-[13px] sm:text-[14px]"
          />
          <nav className="hidden min-w-0 flex-nowrap items-center gap-0.5 lg:flex" aria-label="Parent account">
            {PARENT_PORTAL_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(item.href) ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-9 items-center whitespace-nowrap rounded-full px-2.5 py-1.5 text-[13px] font-medium transition-colors",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-900",
                  isActive(item.href)
                    ? "border border-ink-900 bg-ink-900 text-white"
                    : "border border-ink-200 bg-white text-ink-700 hover:border-ink-300 hover:bg-ink-50 hover:text-ink-900",
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex shrink-0 items-center gap-1.5">
            <Link
              href="/dashboard/student/book"
              className="inline-flex min-h-11 items-center whitespace-nowrap rounded-full border border-ink-900 bg-ink-900 px-3.5 text-sm font-semibold text-white hover:bg-ink-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-900 lg:min-h-9 lg:px-3 lg:text-[13px]"
            >
              <span className="lg:hidden">Book</span>
              <span className="hidden lg:inline">Book a Study Hall</span>
            </Link>
            <LogoutButton className="border-transparent bg-transparent px-2.5 text-[13px] font-medium text-ink-500 hover:border-transparent hover:bg-ink-50 hover:text-ink-700 lg:min-h-9" />
          </div>
        </Container>
        <div className="relative border-t border-ink-100 lg:hidden">
          <nav
            aria-label="Parent account"
            className="flex gap-1.5 overflow-x-auto overscroll-x-contain px-4 py-2.5 pr-10 snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {PARENT_PORTAL_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(item.href) ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 shrink-0 snap-start items-center whitespace-nowrap rounded-full px-3.5 text-[13px] font-medium",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-900",
                  isActive(item.href)
                    ? "border border-ink-900 bg-ink-900 text-white"
                    : "border border-ink-200 bg-white text-ink-700",
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-white to-transparent"
          />
        </div>
      </header>

      <main className="flex-1">{children}</main>
    </div>
  );
}
