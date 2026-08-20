"use client";

import Link from "next/link";
import { useState } from "react";

import { LinkButton } from "@/components/ui/button";
import { PUBLIC_NAV_LINKS } from "@/lib/constants";

export function MobileMenu({
  isAuthed,
  isStudent,
  dashboardHref,
}: {
  isAuthed: boolean;
  isStudent: boolean;
  dashboardHref: string;
}) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-10 w-10 items-center justify-center rounded-full text-ink-800 hover:bg-ink-50"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className="h-6 w-6">
          {open ? (
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
          )}
        </svg>
      </button>

      {open ? (
        <div className="absolute inset-x-0 top-full border-t border-ink-100 bg-white px-6 py-6 shadow-lg">
          <nav className="flex flex-col gap-1">
            {PUBLIC_NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={close}
                className="rounded-lg px-3 py-2.5 text-base font-medium text-ink-700 hover:bg-ink-50"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="mt-5 flex flex-col gap-3">
            {isAuthed ? (
              <>
                <LinkButton href={dashboardHref} variant="outline" className="w-full" onClick={close}>
                  Dashboard
                </LinkButton>
                {isStudent ? (
                  <LinkButton href="/dashboard/student/book" variant="primary" className="w-full" onClick={close}>
                    Book a session
                  </LinkButton>
                ) : null}
              </>
            ) : (
              <>
                <LinkButton href="/login" variant="outline" className="w-full" onClick={close}>
                  Sign in
                </LinkButton>
                <LinkButton href="/signup" variant="primary" className="w-full" onClick={close}>
                  Start free
                </LinkButton>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
