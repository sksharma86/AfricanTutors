import Link from "next/link";

import { Container } from "@/components/ui/container";
import { SUBJECT_CATEGORIES } from "@/components/marketing/subjects-grid";

/**
 * A compact, card-free preview of the subject catalog for the homepage —
 * the full grid with descriptions lives on the dedicated /subjects page.
 * Repeating that whole grid here would just repeat information the
 * visitor can already see, so this stays to a single line of pills.
 */
export function SubjectsPreview() {
  return (
    <section className="py-14">
      <Container className="flex flex-col items-center gap-4 text-center">
        <p className="text-sm font-semibold tracking-wide text-gold-700 uppercase">Subjects</p>
        <div className="flex flex-wrap justify-center gap-2">
          {SUBJECT_CATEGORIES.map((subject) => (
            <span
              key={subject.name}
              className="rounded-full border border-ink-200 px-4 py-1.5 text-sm text-ink-700"
            >
              {subject.name}
            </span>
          ))}
        </div>
        <Link href="/subjects" className="text-sm font-medium text-gold-700 hover:underline">
          See all subjects
        </Link>
      </Container>
    </section>
  );
}
