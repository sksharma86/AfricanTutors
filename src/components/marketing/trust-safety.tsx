import { Container } from "@/components/ui/container";

const CONTROLS = [
  "Guides are carefully vetted and approved before they work with families",
  "Sessions stay on-platform — not through personal contacts",
  "Sessions are recorded for quality and safety",
  "Parents get reports — and recordings for 60 days",
  "Report any session; our team reviews it",
  "Payments are handled securely",
] as const;

export function TrustSafety() {
  return (
    <section className="scroll-mt-24 border-y border-ink-100 bg-white py-20 sm:py-24">
      <Container size="wide">
        <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
          <div>
            <p className="mkt-eyebrow">Trust &amp; safety</p>
            <h2 className="mkt-display mt-3 text-3xl text-ink-900 sm:text-4xl">
              Built with real safeguards.
            </h2>
            <p className="mt-4 max-w-md text-[15px] leading-7 text-ink-500">
              Study Hall at Home manages the experience end to end — so quality and safety are part of
              the product, not an afterthought.
            </p>
          </div>
          <ul className="divide-y divide-ink-100 border-y border-ink-100">
            {CONTROLS.map((c) => (
              <li key={c} className="py-3.5 text-[15px] leading-7 text-ink-700">
                {c}
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </section>
  );
}
