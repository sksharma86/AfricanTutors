import Link from "next/link";

import { BrandLockup } from "@/components/brand/brand-lockup";
import { Container } from "@/components/ui/container";
import { FOOTER_SECTIONS, SITE_NAME } from "@/lib/constants";

export function Footer() {
  return (
    <footer className="border-t border-ink-100 bg-surface/70">
      <Container size="wide" className="grid gap-12 py-16 md:grid-cols-[1.5fr_repeat(5,1fr)]">
        <div className="max-w-sm md:col-span-1">
          <BrandLockup />
          <p className="mt-4 text-[15px] leading-7 text-ink-500">
            Live online Study Hall for families. A highly vetted Guide keeps your child focused while
            they do their own homework.
          </p>
        </div>

        {FOOTER_SECTIONS.map((section) => (
          <div key={section.heading}>
            <p className="text-[11px] font-semibold tracking-[0.12em] text-ink-400 uppercase">
              {section.heading}
            </p>
            <ul className="mt-4 space-y-2.5">
              {section.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-ink-600 transition-colors hover:text-ink-900"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Container>

      <Container
        size="wide"
        className="flex flex-col gap-2 border-t border-ink-100 py-6 text-xs text-ink-400 md:flex-row md:items-center md:justify-between"
      >
        <p>
          &copy; {new Date().getFullYear()} {SITE_NAME}. All rights reserved.
        </p>
        <p>Sessions, scheduling, and payments are managed through {SITE_NAME}.</p>
      </Container>
    </footer>
  );
}
