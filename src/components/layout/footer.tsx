import Link from "next/link";
import { headers } from "next/headers";

import { BrandLockup } from "@/components/brand/brand-lockup";
import { Container } from "@/components/ui/container";
import { FOOTER_SECTIONS, SITE_NAME } from "@/lib/constants";
import { hostnameFrom, isGuideRecruitmentHost } from "@/lib/guide-host.mjs";

export async function Footer() {
  const hostHeader = await headers();
  const guideSite = isGuideRecruitmentHost(
    hostnameFrom(hostHeader.get("x-forwarded-host") || hostHeader.get("host")),
  );
  if (guideSite) {
    return (
      <footer className="border-t border-ink-100 bg-white">
        <Container size="wide" className="flex flex-col gap-3 py-8 text-sm text-ink-500 sm:flex-row sm:items-center sm:justify-between">
          <BrandLockup href="/" variant="product" />
          <p className="flex flex-wrap gap-x-4 gap-y-2">
            <Link href="/apply-to-tutor" className="hover:text-ink-900">
              Become a Guide
            </Link>
            <Link href="/login" className="hover:text-ink-900">
              Log in
            </Link>
            <Link href="/terms" className="hover:text-ink-900">
              Terms
            </Link>
            <Link href="/privacy" className="hover:text-ink-900">
              Privacy
            </Link>
          </p>
        </Container>
      </footer>
    );
  }
  return (
    <footer className="border-t border-ink-100 bg-white">
      <Container size="wide" className="grid gap-7 py-8 md:grid-cols-[1.4fr_repeat(5,1fr)] md:gap-10 md:py-14">
        <div className="max-w-sm">
          <BrandLockup variant="product" />
          <p className="mt-3 text-sm leading-6 text-ink-500">
            Focused academic time. Real human accountability. Better routines.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-7 sm:grid-cols-3 md:contents">
          {FOOTER_SECTIONS.map((section) => (
            <div key={section.heading}>
              <p className="text-[11px] font-semibold tracking-[0.08em] text-ink-400 uppercase">
                {section.heading}
              </p>
              <ul className="mt-3 space-y-2">
                {section.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-sm text-ink-600 transition-colors hover:text-ink-900">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Container>

      <Container
        size="wide"
        className="flex flex-col gap-2 border-t border-ink-100 py-5 text-xs text-ink-400 md:flex-row md:items-center md:justify-between"
      >
        <p>
          &copy; {new Date().getFullYear()} {SITE_NAME}. All rights reserved.
        </p>
        <p>Sessions, scheduling, and payments are managed through {SITE_NAME}.</p>
      </Container>
    </footer>
  );
}
