import Link from "next/link";

import { BrandMark } from "@/components/brand/brand-mark";
import { StudyHallLogo } from "@/components/brand/study-hall-logo";
import { cn } from "@/lib/utils";

/**
 * Product lockup used across public and portal chrome.
 * Marketing and portals use StudyHallLogo (approved house + lamp mark).
 * `variant="legacy"` keeps the historic Africa mark available.
 */
export function BrandLockup({
  href = "/",
  size = 28,
  textClassName,
  className,
  priority,
  variant = "product",
}: {
  href?: string;
  size?: number;
  textClassName?: string;
  className?: string;
  priority?: boolean;
  variant?: "product" | "legacy";
}) {
  void priority;
  if (variant === "legacy") {
    return (
      <Link href={href} className={cn("flex items-center gap-2.5", className)}>
        <BrandMark size={size} priority={priority} />
        <span
          className={cn(
            "text-[15px] font-semibold tracking-[-0.03em] text-ink-900 sm:text-base",
            textClassName,
          )}
        >
          Study Hall <span className="font-medium text-ink-500">(at home)</span>
        </span>
      </Link>
    );
  }

  return (
    <StudyHallLogo href={href} size={size} className={className} textClassName={textClassName} />
  );
}
