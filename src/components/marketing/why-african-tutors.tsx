import type { ReactNode } from "react";

import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";

interface Reason {
  title: string;
  description: string;
  icon: ReactNode;
}

const REASONS: Reason[] = [
  {
    title: "Quality",
    description: "Every tutor is recruited, reviewed, and approved by African Tutors before they teach a single session.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.7} stroke="currentColor" className="h-5 w-5">
        <circle cx="12" cy="12" r="8.5" />
        <path strokeLinecap="round" strokeLinejoin="round" d="m8.5 12 2.5 2.5 4.5-5" />
      </svg>
    ),
  },
  {
    title: "Affordability",
    description: "One-on-one tutoring without typical U.S. tutoring-center pricing — starting at just $17 per hour.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.7} stroke="currentColor" className="h-5 w-5">
        <circle cx="12" cy="12" r="8.5" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.5 9.5A2.5 2.5 0 0 0 12 8c-1.5 0-2.5.9-2.5 2s1 1.8 2.5 2 2.5.9 2.5 2-1 2-2.5 2a2.5 2.5 0 0 1-2.5-1.5M12 6.5v11" />
      </svg>
    ),
  },
  {
    title: "Convenience",
    description: "Book online in minutes and join a private session from home — no commuting, no scheduling headaches.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.7} stroke="currentColor" className="h-5 w-5">
        <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.5 9.5h17M8 3.5v3M16 3.5v3" />
      </svg>
    ),
  },
  {
    title: "Accountability",
    description: "Sessions stay on-platform and are recorded for quality and safety, and you can report any issue.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.7} stroke="currentColor" className="h-5 w-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3.5c2.5 1.3 4.4 1.5 6.5 1.5 0 7-2.6 10.4-6.5 12.5C8.1 15.4 5.5 12 5.5 5c2.1 0 4-.2 6.5-1.5Z" />
      </svg>
    ),
  },
  {
    title: "Flexibility",
    description: "Pay per session, or save with prepaid tutoring hours that never expire. No subscriptions.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.7} stroke="currentColor" className="h-5 w-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h10" />
      </svg>
    ),
  },
];

export function WhyAfricanTutors() {
  return (
    <section id="why" className="scroll-mt-20 py-20">
      <Container>
        <div className="max-w-2xl">
          <p className="text-sm font-semibold tracking-wide text-gold-700 uppercase">Why African Tutors</p>
          <h2 className="mt-3 font-display text-3xl font-semibold text-ink-900 sm:text-4xl">
            Real tutoring, done right — and priced fairly.
          </h2>
          <p className="mt-4 text-base leading-7 text-ink-500">
            African Tutors is a managed tutoring company, not an open marketplace. We handle the hard
            parts so you can focus on learning.
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {REASONS.map((reason) => (
            <Card key={reason.title} className="p-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-forest-50 text-forest-600">
                {reason.icon}
              </div>
              <h3 className="mt-5 text-base font-semibold text-ink-900">{reason.title}</h3>
              <p className="mt-2 text-sm leading-6 text-ink-500">{reason.description}</p>
            </Card>
          ))}
        </div>
      </Container>
    </section>
  );
}
