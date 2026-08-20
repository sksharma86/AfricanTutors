"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

import { BrandLockup } from "@/components/brand/brand-lockup";
import { LinkButton } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { LogoutButton } from "@/components/dashboard/logout-button";
import { cn } from "@/lib/utils";

const NAV: { label: string; href: string }[] = [
  { label: "Dashboard", href: "/dashboard/student" },
  { label: "Pricing", href: "/dashboard/student/packages" },
  { label: "Sessions", href: "/dashboard/student#sessions" },
  { label: "Account", href: "/dashboard/student#account" },
];

/**
 * Premium consumer app shell for the customer area: a clean sticky top bar with
 * simple, obvious navigation and a prominent primary action. Intentionally NOT a
 * left-rail admin dashboard.
 */
export function CustomerShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) => {
    const base = href.split("#")[0];
    if (base === "/dashboard/student") return pathname === "/dashboard/student" && !href.includes("#");
    return pathname.startsWith(base);
  };

  return (
    <div className="flex min-h-full flex-col bg-ink-50/40">
      <header className="sticky top-0 z-40 border-b border-ink-100 bg-white/90 backdrop-blur">
        <Container className="flex h-16 items-center justify-between gap-4">
          <BrandLockup href="/dashboard/student" />

          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
                  isActive(item.href)
                    ? "bg-ink-900 text-white"
                    : "text-ink-600 hover:bg-ink-50 hover:text-ink-900",
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            <LinkButton href="/dashboard/student/book" variant="primary" size="sm">
              Book a session
            </LinkButton>
            <LogoutButton />
          </div>

          <button
            type="button"
            aria-expanded={open}
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-ink-800 hover:bg-ink-50 md:hidden"
          >
            <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.75} stroke="currentColor" className="h-6 w-6">
              {open ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
              )}
            </svg>
          </button>
        </Container>

        {open ? (
          <div className="border-t border-ink-100 bg-white px-6 py-5 md:hidden">
            <nav className="flex flex-col gap-1">
              {NAV.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "rounded-lg px-3 py-2.5 text-base font-medium",
                    isActive(item.href) ? "bg-ink-50 text-ink-900" : "text-ink-700 hover:bg-ink-50",
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="mt-4 flex flex-col gap-3">
              <LinkButton
                href="/dashboard/student/book"
                variant="primary"
                className="w-full"
                onClick={() => setOpen(false)}
              >
                Book a session
              </LinkButton>
              <div className="flex justify-center">
                <LogoutButton />
              </div>
            </div>
          </div>
        ) : null}
      </header>

      <main className="flex-1">{children}</main>
    </div>
  );
}
