import { Reveal } from "@/components/marketing/reveal";
import { TrackCta } from "@/components/marketing/track-cta";
import { Container } from "@/components/ui/container";

const SESSIONS = [
  { day: "Monday", time: "6:00 PM" },
  { day: "Tuesday", time: "6:30 PM" },
  { day: "Wednesday", time: "6:00 PM" },
  { day: "Thursday", time: "7:00 PM" },
] as const;

export function HomePlanWeek({
  primaryHref,
  primaryLabel,
}: {
  primaryHref: string;
  primaryLabel: string;
}) {
  return (
    <section id="plan-week" className="py-20 sm:py-28">
      <Container size="wide">
        <div className="grid items-end gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-20">
          <Reveal>
            <p className="g1-kicker">This week + next week</p>
            <h2 className="g1-display mt-4 max-w-[12ch] text-[2.6rem] text-[var(--g1-ink)] sm:text-[3.6rem] lg:text-[4.2rem]">
              Set the week.
              <span className="mt-2 block">Stop thinking about it.</span>
            </h2>
            <p className="g1-lede mt-6">
              Plan My Week lets a household set Study Halls for this week and next. Nothing further out.
            </p>
          </Reveal>

          <Reveal delay={70}>
            <ol>
              {SESSIONS.map((item) => (
                <li
                  key={item.day}
                  className="flex items-baseline justify-between gap-6 border-t border-[var(--g1-line)] py-4 first:border-t-0"
                >
                  <p className="text-[17px] text-[var(--g1-ink)]">{item.day}</p>
                  <p className="g1-display text-[1.45rem] text-[var(--g1-ink)]">{item.time}</p>
                </li>
              ))}
            </ol>
            <p className="mt-6">
              <TrackCta href={primaryHref} cta={primaryLabel} location="plan_week" variant="text">
                Review 4 Study Halls →
              </TrackCta>
            </p>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}
