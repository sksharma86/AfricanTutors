import { Container } from "@/components/ui/container";

const ITEMS = [
  "Carefully vetted Guides",
  "Recorded sessions",
  "60-day recording access",
  "Call Parent if needed",
  "First hour free",
] as const;

export function TrustRow() {
  return (
    <section aria-label="Why families choose Study Hall" className="border-y border-ink-100/80 bg-surface/70">
      <Container size="wide" className="py-5">
        <ul className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2">
          {ITEMS.map((item) => (
            <li key={item} className="text-[13px] font-medium tracking-[-0.01em] text-ink-600">
              {item}
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
