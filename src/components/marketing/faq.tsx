import { Container } from "@/components/ui/container";
import { FAQ_ITEMS, type FaqItem } from "@/lib/faq";

/**
 * Accessible FAQ built on native <details>/<summary> — keyboard-operable and
 * screen-reader friendly with zero client JS. `items` defaults to the full list;
 * the homepage can pass a shorter subset.
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
    <section id={id} className="scroll-mt-20 py-20">
      <Container className="max-w-3xl">
        <p className="text-sm font-semibold tracking-wide text-gold-700 uppercase">{eyebrow}</p>
        <h2 className="mt-3 font-display text-3xl font-semibold text-ink-900 sm:text-4xl">{title}</h2>
        <dl className="mt-10 divide-y divide-ink-100 border-t border-ink-100">
          {items.map((item) => (
            <div key={item.q} className="py-1">
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500">
                  <dt className="font-medium text-ink-900">{item.q}</dt>
                  <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full border border-ink-200 text-ink-500 transition-transform group-open:rotate-45">
                    <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor" className="h-3.5 w-3.5">
                      <path strokeLinecap="round" d="M12 5v14M5 12h14" />
                    </svg>
                  </span>
                </summary>
                <dd className="pr-10 pb-4 text-sm leading-6 text-ink-600">{item.a}</dd>
              </details>
            </div>
          ))}
        </dl>
      </Container>
    </section>
  );
}
