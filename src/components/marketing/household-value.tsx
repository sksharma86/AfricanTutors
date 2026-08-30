import {
  HOUSEHOLD_VALUE_BODY,
  HOUSEHOLD_VALUE_EYEBROW,
  HOUSEHOLD_VALUE_HEADLINE,
} from "@/lib/household-pricing-copy.mjs";

const CREAM = "#FCFAF6";

export function HouseholdValue() {
  return (
    <section
      id="household"
      aria-labelledby="household-heading"
      className="overflow-x-hidden"
      style={{ backgroundColor: CREAM }}
    >
      <div className="mx-auto max-w-5xl px-5 pb-5 pt-9 sm:px-8 lg:px-10 lg:pb-4 lg:pt-10">
        <p className="text-[11px] font-semibold tracking-[0.16em] text-gold-700 uppercase">
          {HOUSEHOLD_VALUE_EYEBROW}
        </p>
        <h2
          id="household-heading"
          className="mt-1.5 font-display text-[1.65rem] font-semibold leading-tight tracking-[-0.03em] text-ink-900 sm:text-[1.85rem]"
        >
          {HOUSEHOLD_VALUE_HEADLINE}
        </h2>
        <p className="mt-2 max-w-2xl text-[14.5px] leading-6 text-ink-500">{HOUSEHOLD_VALUE_BODY}</p>
      </div>
    </section>
  );
}
