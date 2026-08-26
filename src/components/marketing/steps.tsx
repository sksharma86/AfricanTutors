import { Reveal } from "@/components/marketing/reveal";
import { Container } from "@/components/ui/container";

const STEPS = [
  {
    n: "01",
    title: "Book a time.",
    description: "Add your child and pick an hour. We match an approved Guide.",
  },
  {
    n: "02",
    title: "Your child joins their Guide.",
    description: "They open a private live Study Hall from home. The Guide stays on video.",
  },
  {
    n: "03",
    title: "Homework gets done.",
    description: "Guides supervise and encourage. They do not tutor or complete the work.",
  },
  {
    n: "04",
    title: "You receive the report.",
    description: "A short note lands in your account. The recording stays available for 60 days.",
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
    <section id="how-it-works" className="scroll-mt-24 bg-white py-20 sm:py-28">
      <Container size="wide">
        {withHeader ? (
          <Reveal>
            <p className="mkt-eyebrow">{eyebrow}</p>
            <h2 className="mkt-display mt-3 max-w-[12ch] text-4xl text-ink-900 sm:text-6xl">{title}</h2>
          </Reveal>
        ) : null}

        <ol className={`${withHeader ? "mt-14" : "mt-0"} divide-y divide-ink-100 border-y border-ink-100`}>
          {steps.map((step, index) => (
            <Reveal key={step.title} delay={index * 70}>
              <li className="grid gap-3 py-8 sm:grid-cols-[5rem_1fr] sm:items-baseline lg:grid-cols-[7rem_minmax(0,22rem)_1fr]">
                <p className="text-sm font-semibold tabular-nums text-ink-300">
                  {step.n ?? String(index + 1).padStart(2, "0")}
                </p>
                <h3 className="text-2xl font-semibold tracking-[-0.04em] text-ink-900 sm:text-3xl">
                  {step.title}
                </h3>
                <p className="max-w-md text-[16px] leading-7 text-ink-500">{step.description}</p>
              </li>
            </Reveal>
          ))}
        </ol>
      </Container>
    </section>
  );
}
