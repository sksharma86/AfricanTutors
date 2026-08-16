import type { ReactNode } from "react";

export interface ValueItem {
  title: string;
  description: string;
  icon: ReactNode;
}

/**
 * A tight list of icon + text rows, deliberately NOT wrapped in individual
 * bordered cards. Used where a grid of feature cards would just repeat
 * ideas already established elsewhere on the page — see DECISIONS.md
 * ("avoid card overload").
 */
export function ValueList({ items }: { items: ValueItem[] }) {
  return (
    <ul className="space-y-6">
      {items.map((item) => (
        <li key={item.title} className="flex gap-4">
          <span className="mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded-full bg-gold-50 text-gold-700">
            {item.icon}
          </span>
          <div>
            <p className="font-semibold text-ink-900">{item.title}</p>
            <p className="mt-1 text-sm leading-6 text-ink-500">{item.description}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
