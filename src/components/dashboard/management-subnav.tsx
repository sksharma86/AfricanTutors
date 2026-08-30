"use client";

import { useRef } from "react";

import { cn } from "@/lib/utils";

type Item = { id: string; label: string };

/** Management-only finance/workforce subnav. Does not change PortalSegmentedControl. */
export function ManagementSubnav({
  items,
  value,
  onChange,
  ariaLabel,
}: {
  items: readonly Item[];
  value: string;
  onChange: (id: string) => void;
  ariaLabel: string;
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
    <div role="tablist" aria-label={ariaLabel} className="flex max-w-full flex-wrap gap-1 border-b border-[#1c1915]/10">
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
              "min-h-11 px-3.5 text-sm font-medium tracking-[-0.01em]",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c9a227]",
              selected ? "border-b-2 border-[#c9a227] text-[#5c4310]" : "border-b-2 border-transparent text-[#6b655c] hover:text-[#1c1915]",
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
