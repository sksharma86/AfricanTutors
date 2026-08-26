import { Container } from "@/components/ui/container";

/**
 * Parent outcomes — real capabilities, no fabricated portal screenshots.
 */
export function ProductShowcase() {
  const items = [
    {
      title: "Book from home",
      body: "Choose a child, a length, and a time. We match an available Guide.",
    },
    {
      title: "Reports after every session",
      body: "A short note from the Guide — what they worked on, and how the hour went.",
    },
    {
      title: "Recordings for 60 days",
      body: "Review the session when you want. Recordings are not stored forever.",
    },
    {
      title: "Call Parent, if needed",
      body: "If your child needs you, we reach your phone. Guides never see the number.",
    },
  ];

  return (
    <section id="parent-account" className="scroll-mt-24 py-16 sm:py-22">
      <Container size="wide">
        <div className="max-w-xl">
          <p className="mkt-eyebrow">Your parent account</p>
          <h2 className="mkt-display mt-3 text-3xl text-ink-900 sm:text-[2.6rem]">
            The evening, handled.
          </h2>
          <p className="mt-4 text-[16px] leading-7 text-ink-500">
            Book Study Halls, see what’s next, review reports and recordings, and keep Study Hall
            hours on hand — all in one calm place.
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {items.map((item) => (
            <div
              key={item.title}
              className="rounded-[22px] border border-ink-100 bg-surface p-6 shadow-[var(--shadow-sm)]"
            >
              <h3 className="font-display text-xl text-ink-900">{item.title}</h3>
              <p className="mt-2 text-[15px] leading-7 text-ink-500">{item.body}</p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
