import { Container } from "@/components/ui/container";

const CONTROLS = [
  "Tutors are reviewed and approved before they teach",
  "Sessions happen on-platform, not through personal contact",
  "Sessions are recorded for quality and safety",
  "You can report an issue with any session, and our team reviews it",
  "African Tutors can review session recordings when needed",
  "Payments are handled securely",
  "Tutor and customer contact details aren't unnecessarily shared",
];

export function TrustSafety() {
  return (
    <section className="bg-ink-50/60 py-20">
      <Container className="grid gap-12 md:grid-cols-2 md:items-start">
        <div>
          <p className="text-sm font-semibold tracking-wide text-gold-700 uppercase">Trust &amp; safety</p>
          <h2 className="mt-3 font-display text-3xl font-semibold text-ink-900 sm:text-4xl">
            Built with real safeguards.
          </h2>
          <p className="mt-4 text-base leading-7 text-ink-500">
            African Tutors manages the whole experience — so quality and safety are part of how the
            platform works, not an afterthought.
          </p>
        </div>
        <ul className="space-y-3">
          {CONTROLS.map((c) => (
            <li key={c} className="flex items-start gap-3 rounded-xl border border-ink-100 bg-white px-4 py-3">
              <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} stroke="currentColor" className="mt-0.5 h-4 w-4 flex-none text-forest-500">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3.5c2.5 1.3 4.4 1.5 6.5 1.5 0 7-2.6 10.4-6.5 12.5C8.1 15.4 5.5 12 5.5 5c2.1 0 4-.2 6.5-1.5Z" />
              </svg>
              <span className="text-sm leading-6 text-ink-700">{c}</span>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
