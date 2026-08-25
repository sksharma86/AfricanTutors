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
        <ul className="flex flex-wrap items-center justify-center gap-x-3 gap-y-3 text-center sm:gap-x-2">
          {ITEMS.map((item, i) => (
            <li key={item} className="flex items-center gap-3 text-[13px] font-medium tracking-[-0.01em] text-ink-600 sm:gap-2 md:text-sm">
              {i > 0 ? (
                <span className="hidden h-1 w-1 rounded-full bg-ink-200 sm:mx-3 sm:inline-block" aria-hidden />
              ) : null}
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
