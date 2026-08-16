import { Container } from "@/components/ui/container";

export interface Step {
  title: string;
  description: string;
}

export function Steps({
  eyebrow,
  title,
  steps,
}: {
  eyebrow?: string;
  title: string;
  steps: Step[];
}) {
  return (
    <section className="bg-ink-50/60 py-20">
      <Container>
        <div className="max-w-2xl">
          {eyebrow ? (
            <p className="text-sm font-semibold tracking-wide text-gold-700 uppercase">
              {eyebrow}
            </p>
          ) : null}
          <h2 className="mt-3 font-display text-3xl font-semibold text-ink-900 sm:text-4xl">
            {title}
          </h2>
        </div>

        <ol className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, index) => (
            <li key={step.title} className="relative rounded-2xl bg-white p-6 shadow-sm">
              <span className="font-display text-2xl font-semibold text-gold-500">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-4 text-base font-semibold text-ink-900">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-ink-500">{step.description}</p>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}
