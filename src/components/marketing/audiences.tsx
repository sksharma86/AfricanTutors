import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";

const PARENT_POINTS = [
  "Book online in minutes and your child joins from home",
  "Focused academic time with a highly vetted Guide",
  "Manage multiple children under one parent account",
  "Sessions recorded for quality and safety",
];

const HOUSEHOLD_POINTS = [
  "A calmer academic hour in the evening",
  "Stay nearby without hovering over every assignment",
  "A Guide keeps kids focused and accountable",
  "Encouragement and normal redirection when kids drift off task",
];

export function Audiences() {
  return (
    <section className="py-20">
      <Container className="grid gap-6 md:grid-cols-2">
        <Card className="p-8">
          <p className="text-sm font-semibold tracking-wide text-gold-700 uppercase">For parents</p>
          <h2 className="mt-2 font-display text-2xl font-semibold text-ink-900">Focused time, on your schedule.</h2>
          <ul className="mt-5 space-y-3">
            {PARENT_POINTS.map((p) => (
              <li key={p} className="flex items-start gap-2.5 text-sm leading-6 text-ink-600">
                <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor" className="mt-0.5 h-4 w-4 flex-none text-forest-500">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
                </svg>
                {p}
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-8">
          <p className="text-sm font-semibold tracking-wide text-gold-700 uppercase">For busy evenings</p>
          <h2 className="mt-2 font-display text-2xl font-semibold text-ink-900">Get the hour back.</h2>
          <ul className="mt-5 space-y-3">
            {HOUSEHOLD_POINTS.map((p) => (
              <li key={p} className="flex items-start gap-2.5 text-sm leading-6 text-ink-600">
                <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor" className="mt-0.5 h-4 w-4 flex-none text-forest-500">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
                </svg>
                {p}
              </li>
            ))}
          </ul>
          <p className="mt-5 text-xs leading-5 text-ink-400">
            Study Hall is focused academic time and accountability — not subject-by-subject tutoring.
          </p>
        </Card>
      </Container>
    </section>
  );
}
