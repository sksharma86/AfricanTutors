import Link from "next/link";

import { BrandMark } from "@/components/brand/brand-mark";
import { cn } from "@/lib/utils";

/**
 * The standard "icon on the left, wordmark beside it" lockup used in the
 * navbar and footer. The supplied brand reference is a tall, stacked
 * composition — this horizontal treatment is a deliberate, spec-approved
 * adaptation for a website header (see DECISIONS.md).
 */
export function BrandLockup({
  href = "/",
  size = 40,
  textClassName,
  className,
  priority,
}: {
  href?: string;
  size?: number;
  textClassName?: string;
  className?: string;
  priority?: boolean;
}) {
  return (
    <Link href={href} className={cn("flex items-center gap-2.5", className)}>
      <BrandMark size={size} priority={priority} />
      <span className={cn("font-display text-lg font-semibold text-ink-900", textClassName)}>
        Study Hall at Home
      </span>
    </Link>
  );
}
