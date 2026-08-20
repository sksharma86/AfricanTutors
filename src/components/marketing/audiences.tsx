import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";

const PARENT_POINTS = [
  "Book online in minutes and join from home",
  "Affordable one-on-one help — from $17/hour",
  "Manage multiple children under one account",
  "Sessions recorded for quality and safety",
];

const COLLEGE_POINTS = [
  "Get unstuck on tough coursework and concepts",
  "Prepare for exams with focused one-on-one help",
  "Flexible scheduling around a busy course load",
  "Affordable support when you need it most",
];

export function Audiences() {
  return (
    <section className="py-20">
      <Container className="grid gap-6 md:grid-cols-2">
        <Card className="p-8">
          <p className="text-sm font-semibold tracking-wide text-gold-700 uppercase">For parents</p>
          <h2 className="mt-2 font-display text-2xl font-semibold text-ink-900">Support for your child, on your schedule.</h2>
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
          <p className="text-sm font-semibold tracking-wide text-gold-700 uppercase">For college students</p>
          <h2 className="mt-2 font-display text-2xl font-semibold text-ink-900">Understand the hard stuff — for yourself.</h2>
          <ul className="mt-5 space-y-3">
            {COLLEGE_POINTS.map((p) => (
              <li key={p} className="flex items-start gap-2.5 text-sm leading-6 text-ink-600">
                <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor" className="mt-0.5 h-4 w-4 flex-none text-forest-500">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
                </svg>
                {p}
              </li>
            ))}
          </ul>
          <p className="mt-5 text-xs leading-5 text-ink-400">
            African Tutors provides tutoring to help you learn — tutors do not complete assignments,
            exams, or graded work.
          </p>
        </Card>
      </Container>
    </section>
  );
}
