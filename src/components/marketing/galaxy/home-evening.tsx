import { Reveal } from "@/components/marketing/reveal";
import { Container } from "@/components/ui/container";

const BEATS = [
  { time: "5:55 PM", body: "Study Hall starts in 5 minutes." },
  { time: "6:00 PM", body: "Jay joins his Guide." },
  {
    time: "6:05 PM",
    body: "“What do we need to get done tonight?”",
    list: ["Math worksheet", "Science reading", "English paragraph"],
  },
  { time: "6:32 PM", body: "Jay is working. His Guide is still there." },
  { time: "6:58 PM", body: "Math ✓   Science ✓   English ✓" },
  { time: "7:03 PM", body: "Jay’s Study Hall is complete.", note: "See tonight’s report" },
] as const;

export function HomeEvening() {
  return (
    <section id="evening" className="bg-[var(--g1-bg-warm)] py-20 sm:py-28">
      <Container size="wide">
        <Reveal>
          <p className="g1-kicker">Tonight</p>
          <h2 className="g1-display mt-4 max-w-[14ch] text-[2.5rem] text-[var(--g1-ink)] sm:text-[3.4rem]">
            An evening, hour by hour.
          </h2>
        </Reveal>

        <ol className="mt-14 max-w-3xl">
          {BEATS.map((beat, i) => (
            <Reveal key={beat.time} delay={i * 40}>
              <li className="grid gap-2 border-t border-[var(--g1-line)] py-8 sm:grid-cols-[8.5rem_minmax(0,1fr)] sm:gap-10 sm:py-9">
                <p className="g1-display text-[1.55rem] text-[var(--g1-ink)] sm:text-[1.7rem]">{beat.time}</p>
                <div>
                  <p className="text-[17px] leading-8 text-[var(--g1-ink)] sm:text-[18px]">{beat.body}</p>
                  {"list" in beat && beat.list ? (
                    <ul className="mt-3 space-y-1 text-[15px] text-[var(--g1-muted)]">
                      {beat.list.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  ) : null}
                  {"note" in beat && beat.note ? (
                    <p className="mt-3 text-[15px] text-[var(--g1-subtle)]">{beat.note} →</p>
                  ) : null}
                </div>
              </li>
            </Reveal>
          ))}
        </ol>

        <Reveal delay={80}>
          <p className="g1-display mt-10 max-w-[16ch] text-[2.4rem] leading-[1.05] text-[var(--g1-ink)] sm:mt-16 sm:text-[3.5rem] lg:text-[4rem]">
            An hour of homework.
            <span className="mt-2 block text-[var(--g1-muted)]">Without an hour of managing homework.</span>
          </p>
        </Reveal>
      </Container>
    </section>
  );
}
