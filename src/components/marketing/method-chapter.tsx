import { Reveal } from "@/components/marketing/reveal";
import { Container } from "@/components/ui/container";
import { STUDY_HALL_METHOD } from "@/lib/study-hall-hour";

export function MethodChapter() {
  return (
    <section id="the-study-hall-method" className="bg-white py-20 sm:py-28">
      <Container size="wide">
        <Reveal>
          <h2 className="mkt-display max-w-[16ch] text-4xl text-ink-900 sm:text-5xl">
            Plan → Focus → Finish
          </h2>
          <p className="mt-4 max-w-lg text-[16px] leading-7 text-ink-500">
            Every Study Hall follows a simple rhythm. The subject changes. The routine doesn’t.
          </p>
        </Reveal>

        <ol className="mt-14 grid gap-10 sm:grid-cols-3 sm:gap-12">
          {STUDY_HALL_METHOD.map((step, i) => (
            <Reveal key={step.title} delay={i * 60}>
              <li>
                <p className="font-display text-[2.4rem] font-semibold tracking-[-0.05em] text-ink-900">
                  {step.title}
                </p>
                <p className="mt-3 text-[16px] leading-7 text-ink-500">{step.line}</p>
              </li>
            </Reveal>
          ))}
        </ol>
      </Container>
    </section>
  );
}
