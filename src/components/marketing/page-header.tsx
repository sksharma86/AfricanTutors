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
    <section className="pt-16 pb-10 sm:pt-24 sm:pb-14">
      <Container size="wide">
        {eyebrow ? <p className="mkt-eyebrow">{eyebrow}</p> : null}
        <h1 className="mkt-display mt-4 max-w-3xl text-4xl text-ink-900 sm:text-5xl md:text-6xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-5 max-w-2xl text-lg leading-8 text-ink-500">{description}</p>
        ) : null}
        {children}
      </Container>
    </section>
  );
}
