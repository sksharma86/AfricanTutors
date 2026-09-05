import { Reveal } from "@/components/marketing/reveal";
import { Container } from "@/components/ui/container";
import { STUDY_HALL_365_MONTHLY_USD } from "@/lib/public-offers";
import { ROUTINE_WEEK } from "@/lib/study-hall-hour";

export function Routine365() {
  return (
    <section id="study-hall-365" className="bg-[#f7f6f3] py-20 sm:py-28">
      <Container size="wide">
        <Reveal>
          <h2 className="mkt-display max-w-[12ch] text-4xl text-ink-900 sm:text-5xl lg:text-[3.4rem]">
            One hour.
            <span className="mt-2 block text-ink-400">Repeat it.</span>
          </h2>
          <p className="mt-5 max-w-lg text-[17px] leading-8 text-ink-500">
            One night becomes a routine. A routine becomes a habit.
          </p>
        </Reveal>

        <Reveal delay={70}>
          <p className="mt-12 max-w-3xl font-display text-[1.2rem] font-semibold leading-relaxed tracking-[-0.02em] text-ink-800 sm:hidden">
            {ROUTINE_WEEK.map((item, index) => (
              <span key={item.day}>
                {index > 0 ? <span className="text-ink-300"> · </span> : null}
                <span className="text-ink-400">{item.day}</span> {item.mark}
              </span>
            ))}
          </p>
          <ol className="mt-12 hidden grid-cols-7 gap-3 sm:grid">
            {ROUTINE_WEEK.map((item) => {
              const today = item.mark === "Today";
              return (
                <li key={item.day} className="text-center">
                  <p className="text-[11px] font-semibold tracking-[0.12em] text-ink-400 uppercase">
                    {item.day}
                  </p>
                  <p
                    className={`mt-3 font-display text-[1.25rem] font-semibold tracking-[-0.03em] ${
                      today ? "text-ink-900" : "text-ink-700"
                    }`}
                  >
                    {item.mark}
                  </p>
                </li>
              );
            })}
          </ol>
        </Reveal>

        <Reveal delay={100}>
          <div className="mt-16 border-t border-ink-200 pt-12 lg:flex lg:items-end lg:justify-between lg:gap-16">
            <div className="max-w-xl">
              <h3 className="mkt-display text-3xl text-ink-900 sm:text-4xl">Study Hall 365</h3>
              <p className="mt-4 text-[16px] leading-7 text-ink-500">
                One 60-minute Study Hall available every calendar day. You choose the days and
                times. Unused days do not roll over.
              </p>
              <p className="mt-4 text-[16px] font-medium leading-7 text-ink-800">
                365 means available every day. It doesn’t mean required every day.
              </p>
              <p className="mt-6 text-[15px] leading-7 text-ink-500">
                One price. Up to three siblings.
              </p>
            </div>
            <p className="mt-10 font-display text-[4.5rem] font-semibold leading-none tracking-[-0.05em] text-ink-900 lg:mt-0">
              ${STUDY_HALL_365_MONTHLY_USD}
              <span className="ml-1 text-[1.1rem] font-medium tracking-[-0.02em] text-ink-400">
                /month
              </span>
            </p>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
