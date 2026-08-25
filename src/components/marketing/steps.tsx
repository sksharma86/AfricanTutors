import { Container } from "@/components/ui/container";

const STEPS = [
  {
    n: "1",
    title: "Book a time",
    description: "Add your child and pick a Study Hall that fits tonight — or build a routine.",
  },
  {
    n: "2",
    title: "They join live",
    description: "Your child opens the session from home. A highly vetted Guide is already there.",
  },
  {
    n: "3",
    title: "Homework moves",
    description: "The Guide keeps them focused and on task while they do their own schoolwork.",
  },
] as const;

/**
 * Compact how-it-works — three beats, no icon cards, no heavy photography.
 */
export function Steps({
  eyebrow = "How it works",
  title = "Three steps. Then homework starts moving.",
  steps = STEPS,
}: {
  eyebrow?: string;
  title?: string;
  steps?: readonly { n?: string; title: string; description: string }[];
}) {
  return (
    <section id="how-it-works" className="scroll-mt-24 py-20 sm:py-28">
      <Container size="wide">
        <div className="max-w-2xl">
          <p className="mkt-eyebrow">{eyebrow}</p>
          <h2 className="mkt-display mt-3 text-3xl text-ink-900 sm:text-4xl">{title}</h2>
        </div>

        <ol className="mt-12 grid gap-8 border-t border-ink-100 pt-10 sm:grid-cols-3 sm:gap-10">
          {steps.map((step, index) => (
            <li key={step.title}>
              <p className="text-sm font-semibold tabular-nums text-gold-600">
                {step.n ?? String(index + 1)}
              </p>
              <h3 className="mt-3 text-lg font-semibold tracking-[-0.03em] text-ink-900">{step.title}</h3>
              <p className="mt-2 text-[15px] leading-7 text-ink-500">{step.description}</p>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}
