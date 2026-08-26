import { Reveal } from "@/components/marketing/reveal";
import { Container } from "@/components/ui/container";

/**
 * One parent-command composition built from REAL portal capabilities:
 * next Study Hall, child, time, Guide/matching, Join, hours, report, recording.
 */
export function ProductShowcase() {
  return (
    <section id="parent-account" className="scroll-mt-24 bg-[#eef0f3] py-20 sm:py-28">
      <Container size="wide">
        <Reveal>
          <p className="mkt-eyebrow">The parent portal</p>
          <h2 className="mkt-display mt-3 max-w-[16ch] text-4xl text-ink-900 sm:text-5xl lg:text-[3.4rem]">
            Your evening, in one place.
          </h2>
          <p className="mt-4 max-w-xl text-[16px] leading-7 text-ink-500">
            Book a Study Hall, see what’s next, join when it opens, and review the report and
            recording afterward.
          </p>
        </Reveal>

        <Reveal delay={80}>
          <div className="mt-12 overflow-hidden rounded-[20px] border border-ink-200/80 bg-white shadow-[0_30px_80px_-40px_rgba(11,13,16,0.45)]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 px-5 py-4 sm:px-7">
              <p className="text-sm font-semibold tracking-[-0.02em] text-ink-900">Study Hall (at home)</p>
              <div className="flex flex-wrap gap-5 text-sm text-ink-500">
                <span className="font-medium text-ink-900">Dashboard</span>
                <span>Book</span>
                <span>Hours</span>
                <span>Sessions</span>
              </div>
              <span className="rounded-full bg-ink-900 px-3.5 py-1.5 text-xs font-semibold text-white">
                Book a Study Hall
              </span>
            </div>

            <div className="grid lg:grid-cols-[1.2fr_0.8fr]">
              <div className="border-b border-ink-100 p-5 sm:p-7 lg:border-r lg:border-b-0">
                <p className="text-[11px] font-semibold tracking-[0.08em] text-ink-400 uppercase">
                  Next Study Hall
                </p>
                <p className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-ink-900">Tonight, 6:30 PM</p>
                <p className="mt-2 text-[15px] text-ink-600">Maya · 60 minutes · America/Chicago</p>
                <p className="mt-3 text-sm text-ink-500">Guide: Amina · Matching complete</p>
                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <span className="rounded-full bg-ink-900 px-4 py-2 text-sm font-semibold text-white">
                    Join Study Hall
                  </span>
                  <span className="text-sm text-ink-400">Ready to join 5 minutes before start</span>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-1">
                <div className="border-b border-ink-100 p-5 sm:p-6">
                  <p className="text-[11px] font-semibold tracking-[0.08em] text-ink-400 uppercase">
                    Study Hall hours
                  </p>
                  <p className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-ink-900">11h 30m</p>
                  <p className="mt-1 text-sm text-ink-500">Prepaid hours never expire</p>
                  <p className="mt-3 text-sm font-semibold text-ink-900">Buy hours &amp; save</p>
                </div>
                <div className="p-5 sm:p-6">
                  <p className="text-[11px] font-semibold tracking-[0.08em] text-ink-400 uppercase">
                    Last report
                  </p>
                  <p className="mt-2 text-lg font-semibold tracking-[-0.03em] text-ink-900">
                    Maya’s Study Hall
                  </p>
                  <p className="mt-1 text-sm text-ink-500">Tue · Focus: Strong · Redirection: Light</p>
                  <p className="mt-3 text-sm leading-6 text-ink-600">
                    Finished math, then reading. Stayed with the work after one calm redirect.
                  </p>
                  <p className="mt-4 text-sm font-semibold text-ink-900">
                    Recording ready · Watch recording
                    <span className="ml-2 font-medium text-ink-400">Available for 60 days</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
