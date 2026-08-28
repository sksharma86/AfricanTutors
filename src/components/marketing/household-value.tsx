import { Container } from "@/components/ui/container";
import {
  HOUSEHOLD_VALUE_BODY,
  HOUSEHOLD_VALUE_EYEBROW,
  HOUSEHOLD_VALUE_LINES,
} from "@/lib/household-pricing-copy.mjs";

/**
 * Early homepage household cue. Typography only — no photography, no card wall.
 */
export function HouseholdValue() {
  const [one, two, three] = HOUSEHOLD_VALUE_LINES;

  return (
    <section id="household" className="bg-[#f7f6f3] py-12 sm:py-16">
      <Container size="wide">
        <p className="mkt-eyebrow">{HOUSEHOLD_VALUE_EYEBROW}</p>
        <h2 className="mkt-display mt-3 max-w-[16ch] text-3xl text-ink-900 sm:text-[2.55rem]">
          {one}
          <span className="mt-1 block">{two}</span>
          <span className="mt-1 block">{three}</span>
        </h2>
        <p className="mt-5 max-w-xl text-[16px] leading-7 text-ink-600">{HOUSEHOLD_VALUE_BODY}</p>
      </Container>
    </section>
  );
}
