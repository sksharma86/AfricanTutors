import { Container } from "@/components/ui/container";

const STEPS = [
  {
    n: "1",
    title: "Book a Study Hall",
    description: "Add your child and pick a time. We match a highly vetted Guide.",
  },
  {
    n: "2",
    title: "They join live",
    description: "Your child opens the session from home. The Guide keeps them focused on their own homework.",
  },
  {
    n: "3",
    title: "You’re still within reach",
    description:
      "If they need you, the Guide can contact you through Call Parent — without seeing your private number.",
  },
  {
    n: "4",
    title: "See how it went",
    description:
      "Afterward, check a short session report and a recording in your account — available for 60 days.",
  },
] as const;

/**
 * How Study Hall works as a complete loop — book → attend → reach parent → report.
 */
export function Steps({
  eyebrow = "How it works",
  title = "The whole experience, thought through.",
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
          <p className="mt-4 max-w-xl text-[15px] leading-7 text-ink-500">
            Not just a video call — a complete Study Hall system from booking to report.
          </p>
        </div>

        <ol className="mt-12 grid gap-8 border-t border-ink-100 pt-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
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
