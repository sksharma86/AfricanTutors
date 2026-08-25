import { Container } from "@/components/ui/container";

const ITEMS = [
  "Highly vetted Guides",
  "Live video Study Hall",
  "Focus & accountability",
  "Session reports",
  "First hour free",
] as const;

/** Thin trust / value ribbon — typography only, no cards. */
export function TrustRow() {
  return (
    <section aria-label="Why families choose Study Hall" className="border-y border-ink-100/80">
      <Container size="wide" className="py-6 sm:py-7">
        <ul className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:flex lg:flex-wrap lg:items-center lg:justify-between lg:gap-4">
          {ITEMS.map((item) => (
            <li
              key={item}
              className="text-[13px] font-medium tracking-[-0.01em] text-ink-600 md:text-sm lg:text-center"
            >
              {item}
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
