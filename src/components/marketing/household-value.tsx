import {
  HOUSEHOLD_VALUE_BODY,
  HOUSEHOLD_VALUE_EYEBROW,
  HOUSEHOLD_VALUE_HEADLINE,
  HOUSEHOLD_VALUE_STEPS,
} from "@/lib/household-pricing-copy.mjs";

const GOLD = "#C99125";
const CREAM = "#FCFAF6";

function ChildMarks({ count }: { count: 1 | 2 | 3 }) {
  return (
    <span className="inline-flex items-end gap-0.5" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <svg key={index} viewBox="0 0 16 20" className="h-5 w-4" fill="none">
          <circle cx="8" cy="4.5" r="2.6" stroke={GOLD} strokeWidth="1.4" />
          <path
            d="M3.2 18.2c.4-4.1 2.2-6.2 4.8-6.2s4.4 2.1 4.8 6.2"
            stroke={GOLD}
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
      ))}
    </span>
  );
}

export function HouseholdValue() {
  return (
    <section
      id="household"
      aria-labelledby="household-heading"
      className="overflow-x-hidden"
      style={{ backgroundColor: CREAM }}
    >
      <div className="mx-auto max-w-5xl px-5 py-9 sm:px-8 lg:px-10 lg:py-10">
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

        <ol className="mt-6 flex flex-col divide-y divide-[#E6E0D7] border-t border-[#E6E0D7] pt-5 sm:flex-row sm:divide-x sm:divide-y-0">
          {HOUSEHOLD_VALUE_STEPS.map((step, index) => (
            <li
              key={step.count}
              className="flex flex-1 items-center gap-3 py-3 first:pt-0 last:pb-0 sm:flex-col sm:items-start sm:gap-1.5 sm:px-5 sm:py-0 first:sm:pl-0 last:sm:pr-0"
            >
              <div className="flex items-center gap-2.5">
                <ChildMarks count={(index + 1) as 1 | 2 | 3} />
                <p className="text-[13px] font-semibold tracking-wide text-ink-900">{step.count}</p>
              </div>
              <p className="text-[12px] leading-snug text-ink-500">{step.price}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
