"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Editorial annotations for the homepage Parent Portal showcase.
 * Labels live in CSS-grid gutters. Arrow paths are measured against the
 * portal stage so they stay attached as width and zoom change.
 * Home is the truthful planning surface in this preview (no Plan My Week control).
 */
const NOTES = [
  {
    id: "plan",
    title: "Plan the week",
    copy: "See what’s coming up and plan Study Halls for the week.",
    target: "Home",
    from: "right" as const,
  },
  {
    id: "join",
    title: "Join when it’s time",
    copy: "One click to join your child’s Study Hall.",
    target: "Join Study Hall →",
    from: "left" as const,
  },
  {
    id: "review",
    title: "See how it went",
    copy: "Read the report and watch the recording after each Study Hall.",
    target: "Report ready",
    from: "right" as const,
  },
] as const;

function findExactText(root: Element, text: string) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = walker.nextNode())) {
    if (node.textContent?.trim() === text) return node;
  }
  return null;
}

function textBox(root: Element, text: string) {
  const node = findExactText(root, text);
  if (!node) return null;
  const range = document.createRange();
  range.selectNodeContents(node);
  const tight = range.getBoundingClientRect();
  if (tight.width > 2 && tight.height > 2) return tight;
  return node.parentElement?.getBoundingClientRect() ?? null;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function curve(x1: number, y1: number, x2: number, y2: number, id: string, w: number, h: number) {
  const cx = (n: number) => clamp(n, 2, Math.max(4, w - 2));
  const cy = (n: number) => clamp(n, 2, Math.max(4, h - 2));
  x1 = cx(x1);
  y1 = cy(y1);
  x2 = cx(x2);
  y2 = cy(y2);
  if (id === "plan") {
    return `M ${x1} ${y1} C ${cx(x1 + 28)} ${cy(y1 - 22)}, ${cx(x2 - 18)} ${cy(y2 - 16)}, ${x2} ${y2}`;
  }
  if (id === "join") {
    const lift = Math.min(72, Math.max(36, Math.abs(x1 - x2) * 0.16));
    return `M ${x1} ${y1} C ${cx(x1 - 80)} ${cy(y1 - lift)}, ${cx(x2 + 70)} ${cy(y2 - lift * 0.55)}, ${x2} ${y2}`;
  }
  return `M ${x1} ${y1} C ${cx(x1 + 56)} ${cy(y1 + 28)}, ${cx(x2 - 40)} ${cy(y2 + 18)}, ${x2} ${y2}`;
}

export function PortalCallouts() {
  const planRef = useRef<HTMLDivElement>(null);
  const joinRef = useRef<HTMLDivElement>(null);
  const reviewRef = useRef<HTMLDivElement>(null);
  const [paths, setPaths] = useState<string[]>([]);
  const [viewBox, setViewBox] = useState("0 0 1 1");

  useEffect(() => {
    const refs = { plan: planRef, join: joinRef, review: reviewRef };
    const mq = window.matchMedia("(min-width: 1180px)");

    const measure = () => {
      if (!mq.matches) {
        setPaths([]);
        return;
      }
      const stage = planRef.current?.closest(".sh-home-portal__stage");
      const frame = stage?.querySelector(".sh-home-portal__frame");
      if (!stage || !frame) {
        setPaths([]);
        return;
      }
      const origin = stage.getBoundingClientRect();
      if (origin.width < 8 || origin.height < 8) {
        setPaths([]);
        return;
      }
      setViewBox(`0 0 ${origin.width} ${origin.height}`);
      const next: string[] = [];
      for (const note of NOTES) {
        const el = refs[note.id].current;
        const target = textBox(frame, note.target);
        if (!el || !target) continue;
        const box = el.getBoundingClientRect();
        const x1 = note.from === "right" ? box.right - origin.left + 4 : box.left - origin.left - 4;
        const y1 = box.top - origin.top + Math.min(22, box.height * 0.28);
        const x2 = note.from === "right" ? target.left - origin.left - 8 : target.right - origin.left + 8;
        const y2 = target.top - origin.top + target.height / 2;
        next.push(curve(x1, y1, x2, y2, note.id, origin.width, origin.height));
      }
      setPaths(next);
    };

    const stage = planRef.current?.closest(".sh-home-portal__stage");
    const frame = stage?.querySelector(".sh-home-portal__frame");
    const ro = new ResizeObserver(() => measure());
    if (stage) ro.observe(stage);
    if (frame) ro.observe(frame);
    window.addEventListener("resize", measure);
    mq.addEventListener("change", measure);
    const id = window.requestAnimationFrame(measure);
    const later = window.setTimeout(measure, 240);
    void document.fonts?.ready.then(measure);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
      mq.removeEventListener("change", measure);
      window.cancelAnimationFrame(id);
      window.clearTimeout(later);
    };
  }, []);

  return (
    <>
      <div className="sh-home-portal__gutter sh-home-portal__gutter--start">
        <div ref={planRef} className="sh-home-portal__note sh-home-portal__note--plan">
          <p className="sh-home-portal__note-title">{NOTES[0].title}</p>
          <p className="sh-home-portal__note-copy">{NOTES[0].copy}</p>
        </div>
        <div ref={reviewRef} className="sh-home-portal__note sh-home-portal__note--review">
          <p className="sh-home-portal__note-title">{NOTES[2].title}</p>
          <p className="sh-home-portal__note-copy">{NOTES[2].copy}</p>
        </div>
      </div>

      <div className="sh-home-portal__gutter sh-home-portal__gutter--end">
        <div ref={joinRef} className="sh-home-portal__note sh-home-portal__note--join">
          <p className="sh-home-portal__note-title">{NOTES[1].title}</p>
          <p className="sh-home-portal__note-copy">{NOTES[1].copy}</p>
        </div>
      </div>

      <svg className="sh-home-portal__arrows" viewBox={viewBox} aria-hidden>
        <defs>
          <marker id="sh-gold-head" markerWidth="8" markerHeight="8" refX="6.2" refY="4" orient="auto">
            <path d="M1.2 1.2 L6.6 4 L1.2 6.8 Z" fill="currentColor" />
          </marker>
        </defs>
        {paths.map((d) => (
          <path
            key={d}
            d={d}
            fill="none"
            stroke="currentColor"
            strokeWidth="2.15"
            strokeLinecap="round"
            markerEnd="url(#sh-gold-head)"
          />
        ))}
      </svg>
    </>
  );
}
