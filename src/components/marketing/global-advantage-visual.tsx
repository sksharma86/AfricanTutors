const STEPS = [
  {
    label: "American Families",
    detail: "Need consistent, affordable one-on-one tutoring",
  },
  {
    label: "African Tutors",
    detail: "Recruits, approves, and manages every tutor",
  },
  {
    label: "Qualified African Academics",
    detail: "Gain access to meaningful, paid teaching opportunities",
  },
];

export function GlobalAdvantageVisual() {
  return (
    <div className="rounded-3xl border border-ink-100 bg-white p-6 shadow-sm sm:p-8">
      <ol className="space-y-0">
        {STEPS.map((step, index) => (
          <li key={step.label} className="relative pb-8 last:pb-0">
            {index < STEPS.length - 1 ? (
              <span
                aria-hidden
                className="absolute top-9 left-4 h-full w-px bg-ink-100"
              />
            ) : null}
            <div className="flex gap-4">
              <span className="relative z-10 flex h-8 w-8 flex-none items-center justify-center rounded-full bg-gold-400 text-sm font-semibold text-ink-900">
                {index + 1}
              </span>
              <div>
                <p className="font-semibold text-ink-900">{step.label}</p>
                <p className="mt-1 text-sm leading-6 text-ink-500">{step.detail}</p>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
