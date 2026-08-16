import type { ReactNode } from "react";

import { Container } from "@/components/ui/container";

export interface Feature {
  title: string;
  description: string;
  icon: ReactNode;
}

export function FeatureGrid({
  eyebrow,
  title,
  description,
  features,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  features: Feature[];
}) {
  return (
    <section className="py-20">
      <Container>
        <div className="max-w-2xl">
          {eyebrow ? (
            <p className="text-sm font-semibold tracking-wide text-brand-600 uppercase">
              {eyebrow}
            </p>
          ) : null}
          <h2 className="mt-3 font-display text-3xl font-semibold text-ink-900 sm:text-4xl">
            {title}
          </h2>
          {description ? (
            <p className="mt-4 text-base leading-7 text-ink-500">{description}</p>
          ) : null}
        </div>

        <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-2xl border border-ink-100 bg-white p-6 transition-shadow hover:shadow-md"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                {feature.icon}
              </div>
              <h3 className="mt-5 text-base font-semibold text-ink-900">{feature.title}</h3>
              <p className="mt-2 text-sm leading-6 text-ink-500">{feature.description}</p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
