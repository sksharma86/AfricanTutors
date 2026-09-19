"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export type PortalStep = "plan" | "join" | "review" | "all";

export const PORTAL_STEPS: ReadonlyArray<{ id: PortalStep; title: string; copy: string }> = [
  {
    id: "plan",
    title: "Plan the week.",
    copy: "Set Study Halls for the days you want. The week shows what’s done, what’s next, and what’s open.",
  },
  {
    id: "join",
    title: "Join when it’s time.",
    copy: "Your next Study Hall, the time, and the Guide sit at the top. One click to join.",
  },
  {
    id: "review",
    title: "See what happened.",
    copy: "After every Study Hall, the report and the recording are waiting for you.",
  },
  {
    id: "all",
    title: "Keep everything in one place.",
    copy: "Scheduling, joining, reports, recordings, and your household’s Study Halls, all in the Parent Portal.",
  },
];

const STAGE_QUERY = "(min-width: 1024px)";

/**
 * Design width of the marketing preview on desktop. The preview is composed
 * to read at this width (about 760 × 500 at scale 1); the whole frame is then
 * scaled as one object only when the column or the height beneath the fixed
 * header is smaller than that. Mirrors --sh-portal-design-width in globals.css.
 */
export const PORTAL_DESIGN_WIDTH = 760;
/** Space kept clear above and below the sticky frame, in px. */
const STAGE_BREATHING_PX = 28;
const STAGE_MIN_SCALE = 0.7;

/**
 * Sticky product reveal. The Parent Portal stays anchored while four short
 * statements scroll past; whichever statement crosses the middle of the
 * viewport becomes the active step and CSS illuminates that region.
 * Below the desktop breakpoint the stage is static and fully lit.
 */
export function PortalReveal({ stage }: { stage: ReactNode }) {
  const stepsRef = useRef<HTMLOListElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const uiRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<PortalStep | null>(null);

  useEffect(() => {
    const list = stepsRef.current;
    if (!list) return;
    const mq = window.matchMedia(STAGE_QUERY);
    let io: IntersectionObserver | null = null;

    const stop = () => {
      io?.disconnect();
      io = null;
      setActive(null);
    };

    const start = () => {
      stop();
      if (!mq.matches) return;
      io = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            const id = (entry.target as HTMLElement).dataset.step as PortalStep | undefined;
            if (id) setActive(id);
          }
        },
        { rootMargin: "-42% 0px -42% 0px", threshold: 0 },
      );
      for (const step of list.querySelectorAll<HTMLElement>("[data-step]")) io.observe(step);
    };

    start();
    mq.addEventListener("change", start);
    return () => {
      mq.removeEventListener("change", start);
      stop();
    };
  }, []);

  // Viewport composition: one scale for the whole frame, derived from both
  // the column width and the height left beneath the fixed header, plus a
  // sticky offset that centres the frame in that usable band.
  useEffect(() => {
    const wrap = wrapRef.current;
    const ui = uiRef.current;
    if (!wrap || !ui) return;
    const mq = window.matchMedia(STAGE_QUERY);

    const fit = () => {
      if (!mq.matches) {
        wrap.style.removeProperty("--sh-portal-scale");
        wrap.style.removeProperty("--sh-portal-top");
        return;
      }
      const header = document.querySelector("header");
      const headerH = header instanceof HTMLElement ? header.getBoundingClientRect().height : 64;
      const usableH = window.innerHeight - headerH - STAGE_BREATHING_PX * 2;
      // The frame lays out at the design width; undo the zoom currently applied
      // to the stage to recover its natural height.
      const stage = ui.parentElement;
      const applied = stage ? Number.parseFloat(getComputedStyle(stage).zoom) || 1 : 1;
      const naturalH = ui.getBoundingClientRect().height / applied;
      const widthScale = wrap.clientWidth / PORTAL_DESIGN_WIDTH;
      const heightScale = naturalH > 0 ? usableH / naturalH : 1;
      const scale = Math.max(STAGE_MIN_SCALE, Math.min(1, widthScale, heightScale));
      const frameH = naturalH * scale;
      const top = headerH + Math.max(STAGE_BREATHING_PX, (window.innerHeight - headerH - frameH) / 2);
      wrap.style.setProperty("--sh-portal-scale", scale.toFixed(4));
      wrap.style.setProperty("--sh-portal-top", `${Math.round(top)}px`);
    };

    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(wrap);
    ro.observe(ui);
    window.addEventListener("resize", fit);
    mq.addEventListener("change", fit);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", fit);
      mq.removeEventListener("change", fit);
    };
  }, []);

  return (
    <div className="sh-home-portal__reveal" data-live={active ? "1" : undefined}>
      <ol ref={stepsRef} className="sh-home-portal__steps">
        {PORTAL_STEPS.map((step, i) => (
          <li
            key={step.id}
            data-step={step.id}
            data-active={active === step.id ? "1" : undefined}
            className="sh-home-portal__step"
          >
            <span className="sh-home-portal__step-index" aria-hidden>
              {String(i + 1).padStart(2, "0")}
            </span>
            <p className="sh-home-display sh-home-portal__step-title">{step.title}</p>
            <p className="sh-home-portal__step-copy">{step.copy}</p>
          </li>
        ))}
      </ol>

      <div ref={wrapRef} className="sh-home-portal__stage-wrap">
        <div className="sh-home-portal__stage" data-step={active ?? undefined}>
          <div ref={uiRef} className="sh-home-portal__frame">
            {stage}
          </div>
        </div>
      </div>
    </div>
  );
}
