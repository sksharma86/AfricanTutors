"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { cn } from "@/lib/utils";

export interface DashboardNavItem {
  label: string;
  /** Path and optional hash, e.g. `/dashboard/admin#sessions` or `/dashboard/admin/finance`. */
  href: string;
}

function splitHref(href: string): { path: string; hash: string | null } {
  const idx = href.indexOf("#");
  if (idx === -1) return { path: href, hash: null };
  return { path: href.slice(0, idx) || "/", hash: href.slice(idx + 1) || null };
}

/**
 * Portal sidebar / mobile strip navigation.
 * - Route items activate from pathname.
 * - Hash items activate from IntersectionObserver + hash deep-links.
 * No SOON / inert items — only real destinations.
 */
export function DashboardSideNav({ items }: { items: DashboardNavItem[] }) {
  const pathname = usePathname();
  const [activeHash, setActiveHash] = useState<string | null>(null);

  const samePageHashes = useMemo(() => {
    return items
      .map((item) => splitHref(item.href))
      .filter((p) => p.hash && (p.path === pathname || p.path === ""))
      .map((p) => p.hash!);
  }, [items, pathname]);

  useEffect(() => {
    const syncHash = () => {
      const h = window.location.hash.replace(/^#/, "");
      setActiveHash(h || null);
    };
    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, []);

  useEffect(() => {
    if (samePageHashes.length === 0) return;

    const elements = samePageHashes
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => Boolean(el));
    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => (b.intersectionRatio ?? 0) - (a.intersectionRatio ?? 0));
        const id = visible[0]?.target?.id;
        if (id) setActiveHash(id);
      },
      { rootMargin: "-15% 0px -60% 0px", threshold: [0, 0.2, 0.45, 0.75] },
    );

    for (const el of elements) observer.observe(el);
    return () => observer.disconnect();
  }, [samePageHashes, pathname]);

  function isActive(item: DashboardNavItem): boolean {
    const { path, hash } = splitHref(item.href);

    if (hash) {
      if (pathname !== path) return false;
      if (activeHash) return activeHash === hash;
      // Default: first same-page hash item until scroll/hash updates.
      return samePageHashes[0] === hash;
    }

    if (path === "/dashboard/admin") {
      return pathname === "/dashboard/admin";
    }
    if (path === "/dashboard/admin/guides") {
      return (
        pathname === path ||
        pathname.startsWith("/dashboard/admin/guides/") ||
        pathname.startsWith("/dashboard/admin/tutors/")
      );
    }
    return pathname === path || pathname.startsWith(`${path}/`);
  }

  return (
    <nav
      aria-label="Portal"
      className="-mx-1 flex gap-1 overflow-x-auto overscroll-x-contain px-1 pb-1 snap-x snap-mandatory lg:mx-0 lg:flex-col lg:space-y-1 lg:overflow-visible lg:px-0 lg:pb-0 lg:snap-none"
    >
      {items.map((item) => {
        const active = isActive(item);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "shrink-0 snap-start whitespace-nowrap rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-900 sm:px-3 sm:py-2.5 sm:text-sm",
              active ? "bg-ink-900 text-white" : "text-ink-600 hover:bg-ink-100 hover:text-ink-900",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
