import Link from "next/link";

import { BrandLockup } from "@/components/brand/brand-lockup";
import { MobileMenu } from "@/components/layout/mobile-menu";
import { Container } from "@/components/ui/container";
import { LinkButton } from "@/components/ui/button";
import { PUBLIC_NAV_LINKS } from "@/lib/constants";

export function Navbar() {
  return (
    <header className="relative z-50 border-b border-ink-100 bg-white/90 backdrop-blur">
      <Container className="flex h-18 items-center justify-between py-3">
        <BrandLockup priority />

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
            Get Started
          </LinkButton>
        </div>

        <MobileMenu />
      </Container>
    </header>
  );
}
