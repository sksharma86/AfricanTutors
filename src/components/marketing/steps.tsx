import { Container } from "@/components/ui/container";

const STEPS = [
  {
    n: "01",
    title: "Book a Study Hall",
    description: "Add your child and pick a time. We match an available, approved Guide.",
  },
  {
    n: "02",
    title: "Your child joins their Guide online",
    description: "They join a private live session from home — camera on, homework in front of them.",
  },
  {
    n: "03",
    title: "The Guide keeps them focused",
    description:
      "Guides supervise and encourage. They stay present, redirect gently, and keep the work moving. They do not tutor or complete homework for the child.",
  },
  {
    n: "04",
    title: "You receive a session report",
    description: "A short note lands in your account. A recording stays available for 60 days.",
  },
] as const;

export function Steps({
  eyebrow = "How it works",
  title = "Four simple steps.",
  steps = STEPS,
}: {
  eyebrow?: string;
  title?: string;
  steps?: readonly { n?: string; title: string; description: string }[];
}) {
  return (
    <section id="how-it-works" className="scroll-mt-24 py-16 sm:py-22">
      <Container size="wide">
        <div className="max-w-xl">
          <p className="mkt-eyebrow">{eyebrow}</p>
          <h2 className="mkt-display mt-3 text-3xl text-ink-900 sm:text-[2.6rem]">{title}</h2>
        </div>

        <ol className="mt-12 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {steps.map((step, index) => (
            <li
              key={step.title}
              className="min-w-0 rounded-[22px] border border-ink-100 bg-surface p-6 shadow-[var(--shadow-sm)]"
            >
              <p className="text-[12px] font-semibold tabular-nums tracking-[0.08em] text-gold-700">
                {step.n ?? String(index + 1).padStart(2, "0")}
              </p>
              <h3 className="mt-4 font-display text-[1.2rem] font-medium tracking-[-0.02em] text-ink-900">
                {step.title}
              </h3>
              <p className="mt-2 text-[14.5px] leading-6 text-ink-500">{step.description}</p>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}
