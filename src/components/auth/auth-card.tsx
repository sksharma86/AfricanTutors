import type { ReactNode } from "react";

import { BrandLockup } from "@/components/brand/brand-lockup";
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
    <section
      aria-label="Study Hall (at home)"
      className="flex flex-1 items-center justify-center bg-[radial-gradient(900px_420px_at_50%_-10%,rgba(232,183,84,0.18),transparent_55%)] py-16"
    >
      <Container className="max-w-md">
        <div className="rounded-[22px] border border-ink-100 bg-surface p-8 shadow-[var(--shadow-md)] sm:p-9">
          <BrandLockup href="/" variant="product" />
          <h1 className="mt-6 font-display text-3xl font-medium text-ink-900">{title}</h1>
          <p className="mt-2 text-sm leading-6 text-ink-500">{description}</p>

          <div className="mt-7">{children}</div>

          <p className="mt-7 text-center text-sm text-ink-500">{footer}</p>
        </div>
      </Container>
    </section>
  );
}
