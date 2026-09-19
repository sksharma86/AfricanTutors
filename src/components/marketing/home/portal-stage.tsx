import { BrandLockup } from "@/components/brand/brand-lockup";
import { ParentIconClock, ParentIconPlay, ParentIconReports } from "@/components/dashboard/parent-icons";
import { PARENT_PORTAL_NAV } from "@/lib/parent-portal.mjs";

/**
 * Homepage marketing preview of the real Parent Portal Home.
 *
 * Purpose-composed for the showcase rather than a pixel copy of the desktop
 * app: the same surfaces the product ships today (Next Study Hall with Join,
 * Your Study Hall Week with Plan my week, Household, Recent Study Hall with
 * report + recording), arranged so the whole frame reads at a glance. The
 * week is shown as a compact day list — the same states the real strip uses
 * (completed / today / scheduled / no Study Hall) — instead of seven narrow
 * columns that collide when the frame is scaled.
 *
 * No invented functionality. `data-region` marks what each reveal step lights.
 */
export const PORTAL_STAGE_WEEK = [
  { day: "Mon", date: 14, kind: "completed", mark: "✓", label: "Completed" },
  { day: "Tue", date: 15, kind: "completed", mark: "✓", label: "Completed" },
  { day: "Wed", date: 16, kind: "none", mark: "—", label: "No Study Hall" },
  { day: "Thu", date: 17, kind: "today", mark: "Today", label: "Today · 6:30 PM" },
  { day: "Fri", date: 18, kind: "scheduled", mark: "•", label: "Scheduled" },
  { day: "Sat", date: 19, kind: "none", mark: "—", label: "No Study Hall" },
  { day: "Sun", date: 20, kind: "scheduled", mark: "•", label: "Scheduled" },
] as const;

export function PortalStage() {
  return (
    <div className="parent-app sh-home-portal__ui" aria-hidden>
      <div className="sh-home-portal__topbar" data-region="chrome">
        <BrandLockup
          href="/"
          variant="product"
          size={18}
          className="pointer-events-none"
          textClassName="text-[12px] whitespace-nowrap"
        />
        <nav className="sh-home-portal__nav">
          {PARENT_PORTAL_NAV.map((item, i) => (
            <span key={item.href} className={i === 0 ? "is-active" : undefined}>
              {item.shortLabel}
            </span>
          ))}
        </nav>
        <span className="sh-home-portal__book">Book a Study Hall</span>
      </div>

      <div className="sh-home-portal__body">
        <div className="sh-home-portal__lead">
          <div className="sh-home-portal__greeting" data-region="chrome">
            <p className="text-[12px] font-medium text-[var(--pp-muted)]">Good evening,</p>
            <p className="text-[1.25rem] font-semibold tracking-[-0.03em] text-[var(--pp-ink)]">Priya</p>
          </div>

          <div className="sh-home-portal__next pp-hero" data-region="next">
            <div className="pp-hero-atmosphere" />
            <div className="relative">
              <p className="text-[10.5px] font-semibold tracking-[0.16em] text-gold-300 uppercase">Next Study Hall</p>
              <p className="mt-2 text-[2.2rem] font-semibold leading-[0.96] tracking-[-0.045em] text-white">6:30 PM</p>
              <p className="mt-1 text-[13px] text-white/70">Tonight</p>
              <div className="mt-3 border-t border-white/12 pt-3">
                <p className="text-[1.02rem] font-medium tracking-[-0.02em] text-white">Jordan</p>
                <p className="mt-0.5 text-[13px] text-white/72">
                  Confirmed · with Guide <span className="font-medium text-white/90">James</span>
                </p>
              </div>
              <div className="mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-2">
                <span
                  data-region="join"
                  className="sh-home-portal__join inline-flex min-h-10 items-center rounded-[11px] bg-[#c9a227] px-4 text-[13px] font-semibold text-[#1c1915]"
                >
                  Join Study Hall →
                </span>
                <span className="text-[13px] font-medium text-white/72">View Study Hall</span>
              </div>
            </div>
          </div>
        </div>

        <div className="sh-home-portal__week" data-region="plan">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10.5px] font-semibold tracking-[0.16em] text-[var(--pp-muted)] uppercase">
                Your Study Hall Week
              </p>
              <p className="mt-0.5 text-[12.5px] text-[var(--pp-muted)]">Sep 14 – Sep 20</p>
            </div>
            <span className="inline-flex min-h-7 shrink-0 items-center rounded-[9px] bg-[#1c1915] px-2.5 text-[12px] font-semibold text-white">
              Plan my week
            </span>
          </div>
          <ol className="sh-home-portal__days">
            {PORTAL_STAGE_WEEK.map((day) => (
              <li key={day.date} className={`sh-home-portal__day is-${day.kind}`}>
                <span className="sh-home-portal__day-name">{day.day}</span>
                <span className="sh-home-portal__day-date">{day.date}</span>
                <span className="sh-home-portal__day-label">{day.label}</span>
                <span className="sh-home-portal__day-mark">{day.mark}</span>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-[12.5px] font-medium text-[var(--pp-ink)]">
            2 of 5 scheduled Study Halls completed this week.
          </p>
        </div>

        <div className="sh-home-portal__status" data-region="chrome">
          <p className="text-[10.5px] font-semibold tracking-[0.14em] text-[var(--pp-muted)] uppercase">Household</p>
          <p className="mt-2 flex items-center gap-2 text-[13px] text-[var(--pp-ink)]">
            <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-[#f3e6c4] text-[#c9a227]">
              <ParentIconClock className="h-3.5 w-3.5" />
            </span>
            <span className="font-semibold">7 Study Halls remaining</span>
          </p>
          <p className="mt-1.5 text-[12px] leading-4 text-[var(--pp-muted)]">Prepaid Study Halls never expire.</p>
        </div>

        <div className="sh-home-portal__recent" data-region="review">
          <p className="text-[10.5px] font-semibold tracking-[0.14em] text-[var(--pp-muted)] uppercase">Recent Study Hall</p>
          <p className="mt-2 text-[13px] font-medium text-[var(--pp-ink)]">
            Jordan <span className="font-normal text-[var(--pp-muted)]">· Tue · 6:30 PM · with Guide Sarah</span>
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-[var(--pp-positive)]">
            <span className="inline-flex items-center gap-1.5">
              <ParentIconReports className="h-3.5 w-3.5" />
              Report ready
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ParentIconPlay className="h-3.5 w-3.5" />
              Recording ready
            </span>
          </div>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            <span className="inline-flex min-h-7 items-center rounded-[9px] border border-[#1c1915]/12 bg-white px-2.5 text-[12px] font-semibold text-[#1c1915]">
              Read report
            </span>
            <span className="inline-flex min-h-7 items-center rounded-[9px] border border-[#1c1915]/12 bg-white px-2.5 text-[12px] font-semibold text-[#1c1915]">
              Watch recording
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
