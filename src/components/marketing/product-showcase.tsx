import {
  ProductCallParentCard,
  ProductHoursCard,
  ProductReportCard,
  ProductStreakCard,
} from "@/components/marketing/product-visuals";
import { Container } from "@/components/ui/container";

/**
 * Parent portal showcase — explicitly framed so first-time visitors understand
 * this is what they get after signing up.
 */
export function ProductShowcase() {
  return (
    <section id="parent-portal" className="scroll-mt-24 border-b border-ink-100/80 bg-surface-muted/40 py-20 sm:py-28">
      <Container size="wide">
        <div className="max-w-2xl">
          <p className="mkt-eyebrow">Your Study Hall account</p>
          <h2 className="mkt-display mt-3 text-3xl text-ink-900 sm:text-4xl lg:text-[2.75rem]">
            Everything in one place.
          </h2>
          <p className="mt-4 max-w-xl text-[17px] leading-7 text-ink-500">
            After every Study Hall, open your parent portal to see upcoming sessions, session
            reports, recordings, available hours, and how your child’s routine is building — and to
            stay reachable if they need you during a session.
          </p>
        </div>

        <div className="mt-12 grid gap-5 lg:grid-cols-2">
          <div className="space-y-5">
            <ProductReportCard />
            <ProductCallParentCard />
          </div>
          <div className="space-y-5">
            <ProductStreakCard />
            <ProductHoursCard />
          </div>
        </div>

        <p className="mt-8 max-w-2xl text-sm leading-6 text-ink-400">
          Illustrations of the parent experience — reports, recordings (available for 60 days),
          prepaid hours, Study Hall streaks, and Call Parent when your child needs you.
        </p>
      </Container>
    </section>
  );
}
