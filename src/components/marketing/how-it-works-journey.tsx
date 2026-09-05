import { Reveal } from "@/components/marketing/reveal";
import { Container } from "@/components/ui/container";

const STEPS = [
  { title: "Choose a time", body: "Pick a 60-minute Study Hall that fits the day." },
  { title: "Join", body: "Your child opens the Parent Portal and starts the hour." },
  { title: "Plan", body: "They name what they’re working on." },
  { title: "Focus", body: "They work. The Guide stays present." },
  { title: "Finish", body: "They leave knowing what got done." },
  { title: "Report", body: "You get a short report and the recording." },
  { title: "Return", body: "Come back and do it again." },
] as const;

export function HowItWorksJourney() {
  return (
    <section id="how-it-works" className="bg-[#fcfaf6] py-16 sm:py-24">
      <Container size="wide">
        <Reveal>
          <h2 className="mkt-display max-w-[14ch] text-3xl text-ink-900 sm:text-4xl">
            One hour. Then another.
          </h2>
          <p className="mt-4 max-w-lg text-[16px] leading-7 text-ink-500">
            The customer journey is short on purpose.
          </p>
        </Reveal>

        <ol className="mt-14 divide-y divide-ink-100 border-y border-ink-100">
          {STEPS.map((step, index) => (
            <li key={step.title} className="grid gap-3 py-6 sm:grid-cols-[4rem_12rem_1fr] sm:items-baseline sm:gap-8">
              <p className="font-display text-2xl font-semibold tracking-[-0.04em] text-ink-300">
                {String(index + 1).padStart(2, "0")}
              </p>
              <h3 className="font-display text-xl font-semibold tracking-[-0.03em] text-ink-900">{step.title}</h3>
              <p className="text-[16px] leading-7 text-ink-500">{step.body}</p>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}
