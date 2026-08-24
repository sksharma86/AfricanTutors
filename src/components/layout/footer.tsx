import Link from "next/link";

import { BrandLockup } from "@/components/brand/brand-lockup";
import { Container } from "@/components/ui/container";
import { FOOTER_SECTIONS, SITE_NAME } from "@/lib/constants";

export function Footer() {
  return (
    <footer className="border-t border-ink-100 bg-white">
      <Container className="grid gap-10 py-14 md:grid-cols-[1.4fr_repeat(4,1fr)]">
        <div className="max-w-sm">
          <BrandLockup />
          <p className="mt-3 text-sm leading-6 text-ink-500">
            Affordable live homework supervision for families. A trained Guide keeps your children on
            task while they do their schoolwork — your first session is free.
          </p>
        </div>

        {FOOTER_SECTIONS.map((section) => (
          <div key={section.heading}>
            <p className="text-xs font-semibold tracking-wide text-ink-400 uppercase">{section.heading}</p>
            <ul className="mt-3 space-y-2">
              {section.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-ink-600 hover:text-ink-900">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Container>

      <Container className="flex flex-col gap-2 border-t border-ink-100 py-6 text-xs text-ink-400 md:flex-row md:items-center md:justify-between">
        <p>
          &copy; {new Date().getFullYear()} {SITE_NAME}. All rights reserved.
        </p>
        <p>Sessions, scheduling, and payments are managed through {SITE_NAME}.</p>
      </Container>
    </footer>
  );
}
