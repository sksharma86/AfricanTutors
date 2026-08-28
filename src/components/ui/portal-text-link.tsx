import type { ReactNode } from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * Tertiary navigation only — low-priority hops such as Back, View all, Buy hours.
 * High-value actions must use Button / LinkButton instead.
 */
export function PortalTextLink({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "text-sm font-medium text-ink-600 underline-offset-4 hover:text-ink-900 hover:underline",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-900",
        className,
      )}
    >
      {children}
    </Link>
  );
}
