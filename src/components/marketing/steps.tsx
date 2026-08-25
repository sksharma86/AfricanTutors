import Image from "next/image";

import { Container } from "@/components/ui/container";

const STEPS = [
  {
    n: "01",
    title: "Create your family account",
    description: "Add your child in a minute. No credit card for the free session.",
  },
  {
    n: "02",
    title: "Book a Study Hall time",
    description: "Choose a time that fits your evening. We match a highly vetted Guide.",
  },
  {
    n: "03",
    title: "Your child joins live",
    description: "They open the session from home. The Guide keeps them on task while they do their own homework.",
  },
] as const;

/**
 * Editorial how-it-works — numbered rhythm + visual, not an icon-card grid.
 */
export function Steps({
  eyebrow = "How it works",
  title = "From signup to Study Hall in minutes.",
  steps = STEPS,
}: {
  eyebrow?: string;
  title?: string;
  steps?: readonly { n?: string; title: string; description: string }[];
}) {
  return (
    <section id="how-it-works" className="scroll-mt-24 py-24 sm:py-32">
      <Container size="wide">
        <div className="grid gap-14 lg:grid-cols-[0.95fr_1.05fr] lg:items-end lg:gap-20">
          <div>
            <p className="mkt-eyebrow">{eyebrow}</p>
            <h2 className="mkt-display mt-4 max-w-md text-4xl text-ink-900 sm:text-5xl">{title}</h2>
            <p className="mt-5 max-w-md text-base leading-7 text-ink-500">
              Study Hall at Home is a managed service — scheduling, matching, and the live session all
              happen in one place.
            </p>
          </div>
          <div className="relative aspect-[4/3] overflow-hidden rounded-[20px] sm:aspect-[16/11]">
            <Image
              src="/images/marketing/studyhall-focus-close.webp"
              alt="Homework in progress during a live Study Hall session"
              fill
              sizes="(max-width: 1024px) 100vw, 55vw"
              className="object-cover"
            />
          </div>
        </div>

        <ol className="mt-16 grid gap-10 border-t border-ink-100 pt-12 sm:grid-cols-3 sm:gap-8">
          {steps.map((step, index) => (
            <li key={step.title} className="min-w-0">
              <p className="font-mono text-xs tracking-[0.16em] text-gold-700">
                {step.n ?? String(index + 1).padStart(2, "0")}
              </p>
              <h3 className="mt-3 text-lg font-semibold tracking-[-0.02em] text-ink-900">{step.title}</h3>
              <p className="mt-2 text-[15px] leading-7 text-ink-500">{step.description}</p>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}
