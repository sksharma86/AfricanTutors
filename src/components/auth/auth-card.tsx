import Link from "next/link";
import type { ReactNode } from "react";

import { Container } from "@/components/ui/container";

export function AuthCard({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <section className="flex flex-1 items-center justify-center bg-[#f4f5f7] py-16">
      <Container className="max-w-md">
        <div className="rounded-2xl border border-ink-100 bg-white p-8 shadow-sm">
          <Link href="/" className="text-xs font-semibold tracking-wide text-brand-600 uppercase">
            Study Hall <span className="font-medium text-ink-500">(at home)</span>
          </Link>
          <h1 className="mt-3 font-display text-2xl font-semibold text-ink-900">{title}</h1>
          <p className="mt-1.5 text-sm text-ink-500">{description}</p>

          <div className="mt-6">{children}</div>

          <p className="mt-6 text-center text-sm text-ink-500">{footer}</p>
        </div>
      </Container>
    </section>
  );
}
