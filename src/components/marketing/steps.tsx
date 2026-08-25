import { Container } from "@/components/ui/container";

const STEPS = [
  {
    n: "01",
    title: "Book a Study Hall",
    description: "Add your child, pick a time. We match a highly vetted Guide.",
  },
  {
    n: "02",
    title: "They join live",
    description: "Your child joins from home. The Guide keeps them focused on their own homework.",
  },
  {
    n: "03",
    title: "Step away if you need to",
    description:
      "If they need you, Call Parent reaches your phone. Your number stays private — and you don’t need the app open.",
  },
  {
    n: "04",
    title: "See how it went",
    description: "A short report lands in your account. Recordings stay available for 60 days.",
  },
] as const;

export function Steps({
  eyebrow = "How it works",
  title = "Book. Study. Review.",
  steps = STEPS,
}: {
  eyebrow?: string;
  title?: string;
  steps?: readonly { n?: string; title: string; description: string }[];
}) {
  return (
    <section id="how-it-works" className="scroll-mt-24 py-16 sm:py-20">
      <Container size="wide">
        <div className="max-w-lg">
          <p className="mkt-eyebrow">{eyebrow}</p>
          <h2 className="mkt-display mt-3 text-3xl text-ink-900 sm:text-[2.5rem]">{title}</h2>
        </div>

        <ol className="mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
          {steps.map((step, index) => (
            <li key={step.title} className="min-w-0">
              <p className="text-[12px] font-semibold tabular-nums text-ink-300">
                {step.n ?? String(index + 1).padStart(2, "0")}
              </p>
              <h3 className="mt-3 text-[16px] font-semibold tracking-[-0.02em] text-ink-900">
                {step.title}
              </h3>
              <p className="mt-2 text-[14px] leading-6 text-ink-500">{step.description}</p>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}
