import { Container } from "@/components/ui/container";
import { FAQ_ITEMS, type FaqItem } from "@/lib/faq";

/**
 * Accessible FAQ on native details/summary — typography-first, no card chrome.
 */
export function Faq({
  eyebrow = "FAQ",
  title = "Questions, answered.",
  items = FAQ_ITEMS,
  id,
}: {
  eyebrow?: string;
  title?: string;
  items?: FaqItem[];
  id?: string;
}) {
  return (
    <section id={id} className="scroll-mt-24 py-24 sm:py-28">
      <Container size="narrow">
        <p className="mkt-eyebrow">{eyebrow}</p>
        <h2 className="mkt-display mt-4 text-4xl text-ink-900 sm:text-5xl">{title}</h2>
        <dl className="mt-12 divide-y divide-ink-100 border-t border-ink-100">
          {items.map((item) => (
            <div key={item.q}>
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-400">
                  <dt className="text-[17px] font-medium tracking-[-0.015em] text-ink-900">{item.q}</dt>
                  <span
                    className="flex h-8 w-8 flex-none items-center justify-center text-ink-400 transition-transform duration-200 group-open:rotate-45"
                    aria-hidden
                  >
                    <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.75} stroke="currentColor" className="h-4 w-4">
                      <path strokeLinecap="round" d="M12 5v14M5 12h14" />
                    </svg>
                  </span>
                </summary>
                <dd className="pb-5 pr-10 text-[15px] leading-7 text-ink-500">{item.a}</dd>
              </details>
            </div>
          ))}
        </dl>
      </Container>
    </section>
  );
}
