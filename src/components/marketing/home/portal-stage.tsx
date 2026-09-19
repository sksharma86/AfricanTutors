import { BrandLockup } from "@/components/brand/brand-lockup";
import {
  PARENT_NAV_ICONS,
  ParentIconClock,
  ParentIconPlay,
  ParentIconReports,
} from "@/components/dashboard/parent-icons";
import { PARENT_PORTAL_NAV } from "@/lib/parent-portal.mjs";

/**
 * Homepage stage for the real Parent Portal Home.
 * Static composition of the surfaces that exist in the product today:
 * Next Study Hall (Join), Your Study Hall Week (Plan my week), Household,
 * Recent Study Hall (report + recording). No invented functionality.
 *
 * `data-region` marks the surface each reveal step illuminates.
 */
export const PORTAL_STAGE_WEEK = [
  { day: "Mon", date: "Sep 14", kind: "completed", label: "COMPLETED", compact: "Done" },
  { day: "Tue", date: "Sep 15", kind: "completed", label: "COMPLETED", compact: "Done" },
  { day: "Wed", date: "Sep 16", kind: "none", label: "NO STUDY HALL", compact: "—" },
  { day: "Thu", date: "Sep 17", kind: "today", label: "TODAY", compact: "Today", today: true },
  { day: "Fri", date: "Sep 18", kind: "scheduled", label: "SCHEDULED", compact: "Set" },
  { day: "Sat", date: "Sep 19", kind: "none", label: "NO STUDY HALL", compact: "—" },
  { day: "Sun", date: "Sep 20", kind: "scheduled", label: "SCHEDULED", compact: "Set" },
] as const;

export function PortalStage() {
  return (
    <div className="parent-app sh-home-portal__ui" aria-hidden>
      <aside className="sh-home-portal__side" data-region="chrome">
        <BrandLockup
          href="/"
          variant="product"
          size={20}
          className="pointer-events-none px-1"
          textClassName="text-[12px]"
        />
        <nav className="mt-5 flex flex-col gap-0.5">
          {PARENT_PORTAL_NAV.map((item, i) => {
            const Icon = PARENT_NAV_ICONS[item.label as keyof typeof PARENT_NAV_ICONS];
            const active = i === 0;
            return (
              <span
                key={item.href}
                className={
                  active
                    ? "inline-flex min-h-9 items-center gap-2.5 rounded-[11px] bg-[#f3e6c4] px-2.5 text-[12.5px] font-medium text-[#5c4310] shadow-[inset_0_0_0_1px_rgba(201,162,39,0.28)]"
                    : "inline-flex min-h-9 items-center gap-2.5 rounded-[11px] px-2.5 text-[12.5px] font-medium text-[#3d3932]"
                }
              >
                {Icon ? <Icon className={active ? "h-4 w-4 text-[#c9a227]" : "h-4 w-4 text-[#7a7368]"} /> : null}
                {item.label}
              </span>
            );
          })}
        </nav>
        <div className="mt-auto space-y-1.5 pt-6">
          <span className="inline-flex min-h-9 w-full items-center justify-center rounded-[11px] bg-[#c9a227] px-3 text-[12px] font-semibold text-[#1c1915]">
            Book a Study Hall
          </span>
          <span className="inline-flex min-h-9 w-full items-center justify-center rounded-[11px] px-3 text-[12px] font-medium text-[#3d3932]">
            Plan my week
          </span>
        </div>
      </aside>

      <div className="sh-home-portal__main">
        <div className="sh-home-portal__topbar" data-region="chrome">
          <BrandLockup href="/" variant="product" size={18} className="pointer-events-none" textClassName="text-[12px]" />
          <span className="inline-flex min-h-8 items-center rounded-[10px] bg-[#c9a227] px-2.5 text-[12px] font-semibold text-[#1c1915]">
            Book
          </span>
        </div>

        <div className="sh-home-portal__greeting" data-region="chrome">
          <p className="text-[12px] font-medium text-[var(--pp-muted)]">Good evening,</p>
          <p className="text-[1.2rem] font-semibold tracking-[-0.03em] text-[var(--pp-ink)]">Priya</p>
        </div>

        <div className="sh-home-portal__grid">
          <div className="sh-home-portal__next pp-hero" data-region="next">
            <div className="pp-hero-atmosphere" />
            <div className="relative">
              <p className="text-[10px] font-semibold tracking-[0.16em] text-gold-300 uppercase">Next Study Hall</p>
              <p className="mt-2 text-[2.1rem] font-semibold leading-[0.96] tracking-[-0.045em] text-white sm:text-[2.4rem]">
                6:30 PM
              </p>
              <p className="mt-1 text-[12.5px] text-white/68">Tonight</p>
              <div className="mt-3 border-t border-white/12 pt-3">
                <p className="text-[1rem] font-medium tracking-[-0.02em] text-white">Jordan</p>
                <p className="mt-0.5 text-[12.5px] text-white/70">Confirmed</p>
                <p className="mt-0.5 text-[12.5px] text-white/60">
                  with Guide <span className="font-medium text-white/86">James</span>
                </p>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
                <span
                  data-region="join"
                  className="sh-home-portal__join inline-flex min-h-10 items-center rounded-[11px] bg-[#c9a227] px-4 text-[13px] font-semibold text-[#1c1915]"
                >
                  Join Study Hall →
                </span>
                <span className="text-[12.5px] font-medium text-white/70">View Study Hall</span>
              </div>
            </div>
          </div>

          <div className="sh-home-portal__week" data-region="plan">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-[10px] font-semibold tracking-[0.16em] text-[var(--pp-muted)] uppercase">
                  Your Study Hall Week
                </p>
                <p className="mt-0.5 text-[12px] text-[var(--pp-muted)]">Sep 14 – Sep 20</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <span className="inline-flex min-h-8 items-center rounded-[10px] bg-[#1c1915] px-3 text-[12px] font-semibold text-white">
                  Plan my week
                </span>
                <span className="inline-flex min-h-8 items-center rounded-[10px] border border-[#1c1915]/12 bg-white px-3 text-[12px] font-semibold text-[#1c1915]">
                  Book a Study Hall
                </span>
              </div>
            </div>
            <div className="pp-week-strip mt-3">
              {PORTAL_STAGE_WEEK.map((day) => (
                <div
                  key={day.date}
                  className={`pp-week-day is-${day.kind}${"today" in day && day.today ? " is-today" : ""}`}
                >
                  <p className="pp-week-day-name">{day.day}</p>
                  <p className="pp-week-day-date">{day.date}</p>
                  <p className="pp-week-day-state">
                    <span className="hidden sm:inline">{day.label}</span>
                    <span className="sm:hidden">{day.compact}</span>
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[12.5px] font-medium text-[var(--pp-ink)]">
              2 of 5 scheduled Study Halls completed this week.
            </p>
            <p className="mt-0.5 text-[12px] leading-5 text-[var(--pp-muted)]">
              We’re keeping up with our Study Hall routine.
            </p>
          </div>

          <div className="sh-home-portal__status" data-region="chrome">
            <p className="text-[10px] font-semibold tracking-[0.14em] text-[var(--pp-muted)] uppercase">Household</p>
            <p className="mt-2 flex items-center gap-2 text-[13px] text-[var(--pp-ink)]">
              <span className="inline-flex size-6 items-center justify-center rounded-full bg-[#f3e6c4] text-[#c9a227]">
                <ParentIconClock className="h-3.5 w-3.5" />
              </span>
              <span className="font-semibold">7 Study Halls remaining</span>
            </p>
            <p className="mt-2 text-[12.5px] font-medium text-[var(--pp-ink)]">Hours →</p>
          </div>

          <div className="sh-home-portal__recent" data-region="review">
            <p className="text-[10px] font-semibold tracking-[0.14em] text-[var(--pp-muted)] uppercase">Recent Study Hall</p>
            <p className="mt-2 text-[12px] text-[var(--pp-muted)]">Tue · 6:30 PM</p>
            <p className="mt-0.5 text-[13px] font-medium text-[var(--pp-ink)]">Jordan</p>
            <p className="text-[12px] text-[var(--pp-muted)]">with Guide Sarah</p>
            <p className="mt-2 flex items-center gap-1.5 text-[12.5px] text-[var(--pp-positive)]">
              <ParentIconReports className="h-3.5 w-3.5" />
              Report ready
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-[12.5px] text-[var(--pp-positive)]">
              <ParentIconPlay className="h-3.5 w-3.5" />
              Recording ready
            </p>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              <span className="inline-flex min-h-8 items-center rounded-[10px] border border-[#1c1915]/12 bg-white px-2.5 text-[12px] font-semibold text-[#1c1915]">
                Read report
              </span>
              <span className="inline-flex min-h-8 items-center rounded-[10px] border border-[#1c1915]/12 bg-white px-2.5 text-[12px] font-semibold text-[#1c1915]">
                Watch recording
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
