import { Reveal } from "@/components/marketing/reveal";
import { Container } from "@/components/ui/container";

const STEPS = [
  {
    n: "01",
    title: "Pick a time.",
    description: "Choose your child and when homework starts.",
  },
  {
    n: "02",
    title: "They join their Guide.",
    description: "Their Guide keeps the hour focused and moving.",
  },
  {
    n: "03",
    title: "You get the recap.",
    description: "See what got done when the Study Hall ends.",
  },
] as const;

export function Steps({
  eyebrow = "How it works",
  title = "Book. Study Hall. Done.",
  steps = STEPS,
  withHeader = true,
}: {
  eyebrow?: string;
  title?: string;
  steps?: readonly { n?: string; title: string; description: string }[];
  withHeader?: boolean;
}) {
  return (
    <section id="how-it-works" className="scroll-mt-24 bg-white py-16 sm:py-24">
      <Container size="wide">
        {withHeader ? (
          <Reveal>
            <p className="mkt-eyebrow">{eyebrow}</p>
            <h2 className="mkt-display mt-3 max-w-[12ch] text-4xl text-ink-900 sm:text-6xl">{title}</h2>
          </Reveal>
        ) : null}

        <ol className={`${withHeader ? "mt-12" : "mt-0"}`}>
          {steps.map((step, index) => (
            <Reveal key={step.title} delay={index * 70}>
              <li className="grid gap-2 border-t border-ink-100 py-8 last:border-b sm:grid-cols-[5rem_minmax(0,22rem)_1fr] sm:items-baseline sm:gap-8">
                <p className="text-sm font-semibold tabular-nums text-ink-300">
                  {step.n ?? String(index + 1).padStart(2, "0")}
                </p>
                <h3 className="text-[1.65rem] font-semibold tracking-[-0.04em] text-ink-900 sm:text-3xl">
                  {step.title}
                </h3>
                <p className="max-w-md text-[15px] leading-7 text-ink-500 sm:text-[16px]">{step.description}</p>
              </li>
            </Reveal>
          ))}
        </ol>
      </Container>
    </section>
  );
}
