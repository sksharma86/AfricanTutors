import Link from "next/link";

import { BrandLockup } from "@/components/brand/brand-lockup";
import { MobileMenu } from "@/components/layout/mobile-menu";
import { Container } from "@/components/ui/container";
import { LinkButton } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import { PUBLIC_NAV_LINKS } from "@/lib/constants";
import { FREE_TRIAL_CTA } from "@/lib/pricing";
import { DASHBOARD_PATH_BY_ROLE } from "@/lib/roles";

export async function Navbar() {
  const user = await getCurrentUser();
  const dashboardHref = user ? DASHBOARD_PATH_BY_ROLE[user.role] : "/dashboard/student";
  const isStudent = user?.role === "student";

  return (
    <header className="sticky top-0 z-50 border-b border-ink-100/80 bg-white/85 backdrop-blur-xl">
      <Container size="wide" className="flex h-14 items-center justify-between gap-4 sm:h-16">
        <BrandLockup priority variant="product" />

        <nav className="hidden items-center gap-7 md:flex">
          {PUBLIC_NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-[13px] font-medium tracking-[-0.01em] text-ink-500 transition-colors hover:text-ink-900"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          {user ? (
            <>
              <LinkButton href={dashboardHref} variant="ghost" size="sm">
                Dashboard
              </LinkButton>
              {isStudent ? (
                <LinkButton href="/dashboard/student/book" variant="primary" size="sm">
                  Book a session
                </LinkButton>
              ) : null}
            </>
          ) : (
            <>
              <LinkButton href="/login" variant="ghost" size="sm">
                Sign in
              </LinkButton>
              <LinkButton href="/signup" variant="primary" size="sm">
                {FREE_TRIAL_CTA}
              </LinkButton>
            </>
          )}
        </div>

        <MobileMenu isAuthed={Boolean(user)} isStudent={isStudent} dashboardHref={dashboardHref} />
      </Container>
    </header>
  );
}
