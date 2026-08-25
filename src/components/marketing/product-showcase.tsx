import {
  ProductCallParentCard,
  ProductHoursCard,
  ProductReportCard,
  ProductStreakCard,
} from "@/components/marketing/product-visuals";
import { Container } from "@/components/ui/container";

/**
 * Parent account showcase — booking, reports, hours, Call Parent.
 * Call Parent reaches the parent’s phone; the account is for booking & history.
 */
export function ProductShowcase() {
  return (
    <section
      id="parent-account"
      className="scroll-mt-24 border-b border-ink-100 bg-surface-muted/35 py-16 sm:py-20"
    >
      <Container size="wide">
        <div className="max-w-xl">
          <p className="mkt-eyebrow">Your Study Hall account</p>
          <h2 className="mkt-display mt-3 text-3xl text-ink-900 sm:text-[2.5rem]">
            Everything in one place.
          </h2>
          <p className="mt-4 text-[16px] leading-7 text-ink-500">
            Book sessions, review reports and recordings, track prepaid hours, and see how a
            homework routine builds — all from your parent account.
          </p>
        </div>

        <div className="mt-10 overflow-hidden rounded-2xl border border-ink-100 bg-white mkt-depth-sm">
          <div className="grid sm:grid-cols-2">
            <div className="border-b border-ink-100 sm:border-r">
              <ProductReportCard className="rounded-none border-0" />
            </div>
            <div className="border-b border-ink-100">
              <ProductStreakCard className="rounded-none border-0" />
            </div>
            <div className="border-b border-ink-100 sm:border-r sm:border-b-0">
              <ProductHoursCard className="rounded-none border-0" />
            </div>
            <div>
              <ProductCallParentCard className="rounded-none border-0" />
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
