import Link from "next/link";

import { BrandLockup } from "@/components/brand/brand-lockup";
import { Container } from "@/components/ui/container";
import { FOOTER_LINKS, SITE_NAME } from "@/lib/constants";

export function Footer() {
  return (
    <footer className="border-t border-ink-100 bg-white">
      <Container className="flex flex-col gap-8 py-12 md:flex-row md:items-start md:justify-between">
        <div className="max-w-sm">
          <BrandLockup />
          <p className="mt-3 text-sm leading-6 text-ink-500">
            Live, one-on-one online tutoring for American students &mdash; from carefully
            selected African academics. The first 30-minute session is free.
          </p>
        </div>

        <div className="flex flex-wrap gap-x-10 gap-y-4">
          <div>
            <p className="text-xs font-semibold tracking-wide text-ink-400 uppercase">Company</p>
            <ul className="mt-3 space-y-2">
              {FOOTER_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-ink-600 hover:text-ink-900">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold tracking-wide text-ink-400 uppercase">Account</p>
            <ul className="mt-3 space-y-2">
              <li>
                <Link href="/login" className="text-sm text-ink-600 hover:text-ink-900">
                  Log In
                </Link>
              </li>
              <li>
                <Link href="/signup" className="text-sm text-ink-600 hover:text-ink-900">
                  Try a free session
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold tracking-wide text-ink-400 uppercase">
              For Educators
            </p>
            <ul className="mt-3 space-y-2">
              <li>
                <Link href="/apply-to-tutor" className="text-sm text-ink-600 hover:text-ink-900">
                  Apply to Tutor
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </Container>

      <Container className="flex flex-col gap-2 border-t border-ink-100 py-6 text-xs text-ink-400 md:flex-row md:items-center md:justify-between">
        <p>&copy; {new Date().getFullYear()} {SITE_NAME}. All rights reserved.</p>
        <p>Tutoring, scheduling, and payments are all managed through {SITE_NAME}.</p>
      </Container>
    </footer>
  );
}
