import { Container } from "@/components/ui/container";

/**
 * The "why we're called African Tutors" story — aspirational and respectful.
 * Leads with quality; affordability is the advantage; no charity/poverty framing.
 */
export function TalentStory() {
  return (
    <section className="bg-ink-50/60 py-20">
      <Container className="grid gap-12 md:grid-cols-2 md:items-center">
        <div>
          <p className="text-sm font-semibold tracking-wide text-gold-700 uppercase">Our story</p>
          <h2 className="mt-3 font-display text-3xl font-semibold text-ink-900 sm:text-4xl">
            World-class talent isn&apos;t limited by borders.
          </h2>
          <div className="mt-4 space-y-4 text-base leading-7 text-ink-600">
            <p>
              Africa is home to exceptional graduates, educators, and academics. African Tutors builds
              a bridge between qualified African educators and U.S. students who want excellent,
              accessible academic support.
            </p>
            <p>
              Families get outstanding one-on-one tutoring at a genuinely affordable rate. Tutors get
              meaningful, paid academic work. Every tutor is approved by our team before they teach —
              talent opens the door, and our review keeps the bar high.
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-ink-100 bg-white p-6">
            <p className="font-display text-3xl font-semibold text-forest-600">One-on-one</p>
            <p className="mt-2 text-sm leading-6 text-ink-500">
              Every session is private and live — never a recorded lecture or a chatbot.
            </p>
          </div>
          <div className="rounded-2xl border border-ink-100 bg-white p-6">
            <p className="font-display text-3xl font-semibold text-gold-600">Approved</p>
            <p className="mt-2 text-sm leading-6 text-ink-500">
              Tutors are reviewed and approved before they ever meet a student.
            </p>
          </div>
          <div className="rounded-2xl border border-ink-100 bg-white p-6 sm:col-span-2">
            <p className="font-display text-3xl font-semibold text-ink-900">Affordable by design</p>
            <p className="mt-2 text-sm leading-6 text-ink-500">
              A global model lets us keep high-quality tutoring within reach for more families —
              from $17 per hour with prepaid hours.
            </p>
          </div>
        </div>
      </Container>
    </section>
  );
}
