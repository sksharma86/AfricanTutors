import type { ReactNode } from "react";

import { Container } from "@/components/ui/container";

export function PageHeader({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <section className="border-b border-ink-100 bg-white py-16 sm:py-20">
      <Container>
        {eyebrow ? (
          <p className="text-sm font-semibold tracking-wide text-gold-700 uppercase">{eyebrow}</p>
        ) : null}
        <h1 className="mt-3 max-w-2xl font-display text-3xl font-semibold text-ink-900 sm:text-4xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-4 max-w-2xl text-base leading-7 text-ink-500">{description}</p>
        ) : null}
        {children}
      </Container>
    </section>
  );
}
