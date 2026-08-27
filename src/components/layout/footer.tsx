import Link from "next/link";

import { BrandLockup } from "@/components/brand/brand-lockup";
import { Container } from "@/components/ui/container";
import { FOOTER_SECTIONS, SITE_NAME } from "@/lib/constants";

export function Footer() {
  return (
    <footer className="border-t border-ink-100 bg-white">
      <Container size="wide" className="grid gap-8 py-10 md:grid-cols-[1.4fr_repeat(5,1fr)] md:gap-10 md:py-14">
        <div className="max-w-sm">
          <BrandLockup variant="product" />
          <p className="mt-4 text-sm leading-7 text-ink-500">
            Live online Study Hall for families. A highly vetted Guide keeps your child focused while
            they do their own homework.
          </p>
        </div>

        {FOOTER_SECTIONS.map((section) => (
          <div key={section.heading}>
            <p className="text-[11px] font-semibold tracking-[0.08em] text-ink-400 uppercase">
              {section.heading}
            </p>
            <ul className="mt-3.5 space-y-2.5">
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
