"use client";

import { useRef } from "react";

import { cn } from "@/lib/utils";

export type PortalSegment = { id: string; label: string };

/**
 * Shared view switcher for the three portals.
 * Looks like a control group — not floating underlined words.
 * Selected = ink fill. Unselected stay visibly tappable. Status pills must not use this.
 */
export function PortalSegmentedControl({
  items,
  value,
  onChange,
  ariaLabel,
  className,
}: {
  items: readonly PortalSegment[];
  value: string;
  onChange: (id: string) => void;
  ariaLabel: string;
  className?: string;
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  function focusAt(index: number) {
    const item = items[index];
    if (!item) return;
    onChange(item.id);
    refs.current[index]?.focus();
  }

  function move(from: number, dir: number) {
    focusAt((from + dir + items.length) % items.length);
  }

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex max-w-full flex-wrap gap-0.5 rounded-[14px] border border-ink-200 bg-ink-50 p-1",
        className,
      )}
    >
      {items.map((item, index) => {
        const selected = item.id === value;
        return (
          <button
            key={item.id}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(item.id)}
            onKeyDown={(event) => {
              if (event.key === "ArrowRight" || event.key === "ArrowDown") {
                event.preventDefault();
                move(index, 1);
              } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
                event.preventDefault();
                move(index, -1);
              } else if (event.key === "Home") {
                event.preventDefault();
                focusAt(0);
              } else if (event.key === "End") {
                event.preventDefault();
                focusAt(items.length - 1);
              }
            }}
            className={cn(
              "min-h-11 min-w-[4.5rem] rounded-[10px] px-3.5 text-sm font-medium tracking-[-0.01em] transition-colors duration-150",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-900",
              selected
                ? "bg-ink-900 text-white shadow-sm"
                : "bg-transparent text-ink-600 hover:bg-white hover:text-ink-900",
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
