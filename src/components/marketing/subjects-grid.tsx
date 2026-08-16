import { Container } from "@/components/ui/container";

export interface SubjectCategory {
  name: string;
  examples: string;
}

export const SUBJECT_CATEGORIES: SubjectCategory[] = [
  { name: "Math", examples: "Elementary math through Algebra, Geometry, and Calculus" },
  { name: "Science", examples: "Biology, Chemistry, Physics, and Earth Science" },
  { name: "English & Writing", examples: "Reading comprehension, essays, and grammar" },
  { name: "Test Prep", examples: "SAT and ACT preparation" },
  { name: "Foreign Languages", examples: "French and other world languages" },
  { name: "Computer Science", examples: "Intro programming and computer literacy" },
  { name: "History & Social Studies", examples: "U.S. history, world history, and economics" },
  { name: "Study Skills", examples: "Organization, homework help, and time management" },
];

export function SubjectsGrid({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
}) {
  return (
    <section className="py-20">
      <Container>
        <div className="max-w-2xl">
          {eyebrow ? (
            <p className="text-sm font-semibold tracking-wide text-gold-700 uppercase">
              {eyebrow}
            </p>
          ) : null}
          <h2 className="mt-3 font-display text-3xl font-semibold text-ink-900 sm:text-4xl">
            {title}
          </h2>
          {description ? (
            <p className="mt-4 text-base leading-7 text-ink-500">{description}</p>
          ) : null}
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SUBJECT_CATEGORIES.map((subject) => (
            <div
              key={subject.name}
              className="rounded-2xl border border-ink-100 bg-white p-5 transition-shadow hover:shadow-md"
            >
              <h3 className="text-base font-semibold text-ink-900">{subject.name}</h3>
              <p className="mt-1.5 text-sm leading-5 text-ink-500">{subject.examples}</p>
            </div>
          ))}
        </div>

        <p className="mt-6 text-sm text-ink-400">
          Don&apos;t see what you&apos;re looking for? Tell us what your student needs and
          we&apos;ll do our best to match a qualified tutor.
        </p>
      </Container>
    </section>
  );
}
