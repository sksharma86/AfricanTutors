import { Container } from "@/components/ui/container";

const CONTROLS = [
  "Guides are carefully vetted and approved before they work with families",
  "Sessions stay on-platform — not through personal contacts",
  "Sessions are recorded for quality and safety; parents can review recordings for 60 days",
  "If your child needs you, Guides can reach you through Call Parent without seeing your number",
  "Parents get a short session report after every Study Hall",
  "Report any session; our team reviews it",
  "Payments are handled securely",
] as const;

export function TrustSafety() {
  return (
    <section className="scroll-mt-24 border-y border-ink-100 bg-white py-20 sm:py-24">
      <Container size="wide">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
          <div>
            <p className="mkt-eyebrow">Trust &amp; safety</p>
            <h2 className="mkt-display mt-3 text-3xl text-ink-900 sm:text-4xl">
              You’re never in the dark.
            </h2>
            <p className="mt-4 max-w-md text-[15px] leading-7 text-ink-500">
              Session reports keep you informed. Recordings remain available in your account for 60
              days. And if your child needs you during Study Hall, Call Parent brings you back in —
              while your personal number stays private.
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
