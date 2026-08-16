import type { ReactNode } from "react";

import { LinkButton } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

export function InfoSplit({
  eyebrow,
  title,
  children,
  ctaHref,
  ctaLabel,
  visual,
  reverse = false,
  tone = "light",
}: {
  eyebrow?: string;
  title: string;
  children: ReactNode;
  ctaHref?: string;
  ctaLabel?: string;
  visual?: ReactNode;
  reverse?: boolean;
  tone?: "light" | "muted";
}) {
  return (
    <section className={tone === "muted" ? "bg-ink-50/60 py-20" : "py-20"}>
      <Container className="grid gap-12 md:grid-cols-2 md:items-center">
        <div className={reverse ? "md:order-2" : undefined}>
          {eyebrow ? (
            <p className="text-sm font-semibold tracking-wide text-gold-700 uppercase">
              {eyebrow}
            </p>
          ) : null}
          <h2 className="mt-3 font-display text-3xl font-semibold text-ink-900 sm:text-4xl">
            {title}
          </h2>
          <div className="mt-4 space-y-4 text-base leading-7 text-ink-600">{children}</div>
          {ctaHref && ctaLabel ? (
            <div className="mt-6">
              <LinkButton href={ctaHref} variant="outline">
                {ctaLabel}
              </LinkButton>
            </div>
          ) : null}
        </div>
        <div className={reverse ? "md:order-1" : undefined}>{visual}</div>
      </Container>
    </section>
  );
}
