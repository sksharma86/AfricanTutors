import { Reveal } from "@/components/marketing/reveal";
import { Container } from "@/components/ui/container";
import {
  FAMILY_VALUE_BODY,
  FAMILY_VALUE_EYEBROW,
  FAMILY_VALUE_MATH,
} from "@/lib/household-pricing-copy.mjs";
import { STUDY_HALL_365_MONTHLY_USD } from "@/lib/public-offers";

export function StudyHall365() {
  return (
    <section id="study-hall-365" className="scroll-mt-24 bg-ink-900 py-16 text-white sm:py-24">
      <Container size="wide">
        <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-end lg:gap-16">
          <Reveal>
            <p className="text-[13px] font-medium tracking-[0.16em] text-gold-300 uppercase">
              Study Hall 365
            </p>
            <h2 className="mkt-display mt-3 max-w-[12ch] text-4xl sm:text-5xl lg:text-[3.5rem]">
              One Study Hall.
              <span className="mt-2 block text-white/58">Every day.</span>
            </h2>
            <p className="mt-6 max-w-lg text-[16px] leading-7 text-white/70">
              One 60-minute Study Hall available every calendar day while 365 is active. Families
              choose which days to use. A consistent time helps, but it is not required.
            </p>
            <p className="mt-5 max-w-lg text-[16px] font-medium leading-7 text-white">
              365 means available every day. It doesn’t mean required every day.
            </p>
          </Reveal>

          <Reveal delay={80}>
            <p className="font-display text-[4.2rem] font-semibold leading-none tracking-[-0.05em] text-white sm:text-[5rem]">
              ${STUDY_HALL_365_MONTHLY_USD}
              <span className="ml-1 align-middle text-[1.15rem] font-medium tracking-[-0.02em] text-white/50">
                /month
              </span>
            </p>
            <p className="mt-4 text-[15px] leading-7 text-white/58">
              Unused days do not accumulate. Unused days do not roll over.
            </p>
          </Reveal>
        </div>

        <Reveal delay={100}>
          <div className="mt-14 border-t border-white/12 pt-10">
            <p className="text-[12px] font-semibold tracking-[0.14em] text-gold-300 uppercase">
              {FAMILY_VALUE_EYEBROW}
            </p>
            <p className="mt-3 max-w-2xl text-[16px] leading-7 text-white/74">{FAMILY_VALUE_BODY}</p>
            <ul className="mt-6 max-w-2xl space-y-2 text-[15px] leading-7 text-white/68">
              {FAMILY_VALUE_MATH.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <p className="mt-6 max-w-2xl text-[13px] leading-6 text-white/42">
              Not every month has 31 days. The figures above show maximum use in a 31-day month.
            </p>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
