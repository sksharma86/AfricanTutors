import { Reveal } from "@/components/marketing/reveal";
import { Container } from "@/components/ui/container";
import { STUDY_HALL_METHOD } from "@/lib/study-hall-hour";

export function StudyHallMethod({
  compact = false,
}: {
  compact?: boolean;
}) {
  return (
    <section
      id="the-study-hall-method"
      className={`scroll-mt-24 bg-white ${compact ? "py-14 sm:py-20" : "py-16 sm:py-24"}`}
    >
      <Container size="wide">
        <Reveal>
          <p className="mkt-eyebrow">The Study Hall Method</p>
          <h2 className="mkt-display mt-3 max-w-[18ch] text-4xl text-ink-900 sm:text-5xl">
            Plan. Focus. Finish.
          </h2>
          <p className="mt-4 max-w-xl text-[16px] leading-7 text-ink-500">
            The subject changes. The routine doesn’t.
          </p>
        </Reveal>

        <ol className="mt-12 grid gap-8 lg:grid-cols-3 lg:gap-10">
          {STUDY_HALL_METHOD.map((step, i) => (
            <Reveal key={step.id} delay={i * 70}>
              <li className="border-t border-ink-100 pt-6">
                <p className="text-[12px] font-semibold tracking-[0.16em] text-gold-700 uppercase">
                  {String(i + 1).padStart(2, "0")}
                </p>
                <h3 className="mt-3 font-display text-[1.85rem] font-semibold tracking-[-0.04em] text-ink-900 sm:text-[2.1rem]">
                  {step.title}
                </h3>
                <p className="mt-3 text-[15px] leading-7 text-ink-500">{step.lead}</p>
                <ul className="mt-5 space-y-2 text-[15px] leading-6 text-ink-700">
                  {step.prompts.map((prompt) => (
                    <li key={prompt}>{prompt}</li>
                  ))}
                </ul>
              </li>
            </Reveal>
          ))}
        </ol>
      </Container>
    </section>
  );
}
