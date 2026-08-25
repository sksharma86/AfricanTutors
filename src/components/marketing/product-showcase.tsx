import {
  ProductHoursCard,
  ProductReportCard,
  ProductStreakCard,
} from "@/components/marketing/product-visuals";
import { Container } from "@/components/ui/container";

/**
 * Product demonstration — what the service feels like after a session.
 * One strong visual moment, not a wall of fake dashboards.
 */
export function ProductShowcase() {
  return (
    <section className="border-b border-ink-100/80 bg-surface-muted/40 py-20 sm:py-28">
      <Container size="wide">
        <div className="max-w-2xl">
          <p className="mkt-eyebrow">The product</p>
          <h2 className="mkt-display mt-3 text-3xl text-ink-900 sm:text-4xl lg:text-[2.75rem]">
            See Study Hall in action.
          </h2>
          <p className="mt-4 max-w-xl text-[17px] leading-7 text-ink-500">
            Book online. Your child joins a live session. You get a clear report — and hours that
            never expire when you prepay.
          </p>
        </div>

        <div className="mt-12 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
          <ProductReportCard />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1">
            <ProductStreakCard />
            <ProductHoursCard />
          </div>
        </div>
      </Container>
    </section>
  );
}
