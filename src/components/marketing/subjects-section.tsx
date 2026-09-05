import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import type { PublicSubjectCategory } from "@/lib/marketing";

export function SubjectsSection({
  categories,
  withHeader = true,
}: {
  categories: PublicSubjectCategory[];
  withHeader?: boolean;
}) {
  return (
    <section id="subjects" className="scroll-mt-20 py-20">
      <Container>
        {withHeader ? (
          <div className="max-w-2xl">
            <p className="text-sm font-semibold tracking-wide text-gold-700 uppercase">What kids work on</p>
            <h2 className="mt-3 font-display text-3xl font-semibold text-ink-900 sm:text-4xl">
              The work kids bring to Study Hall.
            </h2>
            <p className="mt-4 text-base leading-7 text-ink-500">
              Kids work on their own assignments while a Guide keeps them focused and accountable.
            </p>
          </div>
        ) : null}

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((cat) => (
            <Card key={cat.category} className="p-6">
              <h3 className="text-base font-semibold text-ink-900">{cat.label}</h3>
              <p className="mt-1.5 text-sm leading-6 text-ink-500">
                {cat.subjects.slice(0, 4).join(" · ")}
                {cat.subjects.length > 4 ? " · and more" : ""}
              </p>
            </Card>
          ))}
        </div>

        <p className="mt-6 text-sm text-ink-400">
          Kids can work on homework from any of these areas — and anything else they bring.
        </p>
      </Container>
    </section>
  );
}
