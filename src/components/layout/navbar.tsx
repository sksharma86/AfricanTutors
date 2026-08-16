import Link from "next/link";

import { MobileMenu } from "@/components/layout/mobile-menu";
import { Container } from "@/components/ui/container";
import { LinkButton } from "@/components/ui/button";
import { PUBLIC_NAV_LINKS, SITE_NAME } from "@/lib/constants";

export function Navbar() {
  return (
    <header className="relative z-50 border-b border-ink-100 bg-white/90 backdrop-blur">
      <Container className="flex h-18 items-center justify-between py-3">
        <Link href="/" className="flex items-center gap-2">
          <span
            aria-hidden
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-ink-900 font-display text-base font-semibold text-white"
          >
            A
          </span>
          <span className="font-display text-lg font-semibold text-ink-900">{SITE_NAME}</span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {PUBLIC_NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-ink-600 transition-colors hover:text-ink-900"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <LinkButton href="/login" variant="ghost" size="sm">
            Log In
          </LinkButton>
          <LinkButton href="/signup" variant="primary" size="sm">
            Try 30 Min Free
          </LinkButton>
        </div>

        <MobileMenu />
      </Container>
    </header>
  );
}
