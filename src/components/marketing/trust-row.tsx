import { Container } from "@/components/ui/container";

const ITEMS = [
  "Highly vetted Guides",
  "Live video sessions",
  "Focus & accountability",
  "Session reports",
  "First hour free",
] as const;

export function TrustRow() {
  return (
    <section aria-label="Why families choose Study Hall" className="border-b border-ink-100 bg-white">
      <Container size="wide" className="py-5">
        <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 sm:justify-between">
          {ITEMS.map((item) => (
            <li key={item} className="text-[13px] font-medium tracking-[-0.01em] text-ink-500">
              {item}
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
