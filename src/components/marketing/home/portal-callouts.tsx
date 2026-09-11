"use client";

import { useEffect, useRef, useState } from "react";

type CalloutId = "plan" | "join" | "review";

type Callout = {
  id: CalloutId;
  label: string;
  target: string;
  from: "right" | "left";
  region: "upper-left" | "right" | "lower-left";
};

const CALLOUTS: Callout[] = [
  { id: "plan", label: "Plan the week", target: "Study Halls", from: "right", region: "upper-left" },
  { id: "join", label: "Join when it’s time", target: "Join Study Hall →", from: "left", region: "right" },
  { id: "review", label: "See how it went", target: "Report ready", from: "right", region: "lower-left" },
];

type Drawn = {
  id: CalloutId;
  label: string;
  lx: number;
  ly: number;
  path: string;
};

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
  return Math.max(min, Math.min(max, n));
}

function curve(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  id: CalloutId,
) {
  if (id === "plan") {
    return `M ${x1} ${y1} C ${x1 + 26} ${y1 - 16}, ${x2 - 34} ${y2 - 10}, ${x2} ${y2}`;
  }
  if (id === "join") {
    const lift = clamp(Math.abs(x1 - x2) * 0.18, 46, 86);
    return `M ${x1} ${y1} C ${x1 - 70} ${y1 - lift}, ${x2 + 90} ${y2 - lift * 0.7}, ${x2} ${y2}`;
  }
  return `M ${x1} ${y1} C ${x1 + 36} ${y1 + 28}, ${x2 - 48} ${y2 + 22}, ${x2} ${y2}`;
}

export function PortalCallouts() {
  const layerRef = useRef<HTMLDivElement>(null);
  const labelRefs = useRef<Record<string, HTMLSpanElement | null>>({});
  const [drawn, setDrawn] = useState<Drawn[]>([]);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    const stage = layer.closest(".sh-home-portal__stage");
    const frame = stage?.querySelector(".sh-home-portal__frame");
    if (!stage || !frame) return;

    const measure = () => {
      if (window.matchMedia("(max-width: 1023px)").matches) {
        setDrawn([]);
        return;
      }

      const origin = layer.getBoundingClientRect();
      const frameBox = frame.getBoundingClientRect();
      const next: Drawn[] = [];

      for (const item of CALLOUTS) {
        const target = textBox(frame, item.target);
        const label = labelRefs.current[item.id];
        if (!target || !label) continue;

        const gutterLeft = frameBox.left - origin.left;
        const gutterRight = origin.right - frameBox.right;
        const labelBox = label.getBoundingClientRect();
        const lw = labelBox.width || 132;
        const lh = labelBox.height || 20;

        let lx = 0;
        let ly = 0;
        if (item.region === "upper-left") {
          lx = clamp(gutterLeft - lw - 16, 8, Math.max(8, gutterLeft - 12));
          ly = target.top - origin.top + target.height / 2 - lh / 2;
        } else if (item.region === "right") {
          lx = clamp(frameBox.right - origin.left + 16, origin.width - lw - 20, origin.width - lw - 8);
          if (gutterRight < lw + 12) lx = frameBox.right - origin.left - 8;
          ly = target.top - origin.top + target.height / 2 - lh / 2;
        } else {
          lx = clamp(gutterLeft - lw - 16, 8, Math.max(8, gutterLeft - 12));
          ly = target.top - origin.top + target.height / 2 - lh / 2;
        }

        label.style.left = `${lx}px`;
        label.style.top = `${ly}px`;

        const placed = label.getBoundingClientRect();
        const x1 =
          item.from === "right" ? placed.right - origin.left + 5 : placed.left - origin.left - 5;
        const y1 = placed.top - origin.top + placed.height / 2;
        const x2 =
          item.from === "right" ? target.left - origin.left - 8 : target.right - origin.left + 8;
        const y2 = target.top - origin.top + target.height / 2;

        next.push({
          id: item.id,
          label: item.label,
          lx,
          ly,
          path: curve(x1, y1, x2, y2, item.id),
        });
      }

      setDrawn(next);
    };

    const ro = new ResizeObserver(() => measure());
    ro.observe(stage);
    ro.observe(frame);
    window.addEventListener("resize", measure);
    const id = window.requestAnimationFrame(measure);
    const t = window.setTimeout(measure, 240);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
      window.cancelAnimationFrame(id);
      window.clearTimeout(t);
    };
  }, []);

  return (
    <div ref={layerRef} className="sh-home-portal__callouts" aria-hidden>
      <svg className="sh-home-portal__arrows">
        <defs>
          <marker
            id="sh-portal-arrowhead"
            markerWidth="7"
            markerHeight="7"
            refX="5.2"
            refY="3.5"
            orient="auto"
          >
            <path
              d="M1 1 L5.4 3.5 L1 6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.15"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </marker>
        </defs>
        {drawn.map((item) => (
          <g key={item.id}>
            <path className="sh-home-portal__arrow-halo" d={item.path} />
            <path
              className="sh-home-portal__arrow"
              d={item.path}
              markerEnd="url(#sh-portal-arrowhead)"
            />
          </g>
        ))}
      </svg>

      {CALLOUTS.map((item) => (
        <span
          key={item.id}
          ref={(node) => {
            labelRefs.current[item.id] = node;
          }}
          className={`sh-home-portal__callout sh-home-portal__callout--${item.id}${drawn.some((d) => d.id === item.id) ? " is-placed" : ""}`}
        >
          {item.label}
        </span>
      ))}
    </div>
  );
}
