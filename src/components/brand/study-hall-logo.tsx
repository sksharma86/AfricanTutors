import Link from "next/link";
import type { ReactNode } from "react";

import { StudyHallMark } from "@/components/brand/study-hall-mark";
import type { StudyHallMarkVariant } from "@/lib/brand/study-hall-mark";
import { cn } from "@/lib/utils";

function Wordmark({
  variant,
  className,
}: {
  variant: StudyHallMarkVariant;
  className?: string;
}) {
  const secondary =
    variant === "dark" ? "font-medium text-white/55" : "font-medium text-ink-500";
  return (
    <span
      className={cn(
        "text-[15px] font-semibold tracking-[-0.03em] sm:text-base",
        variant === "dark" ? "text-white" : "text-ink-900",
        className,
      )}
    >
      Study Hall <span className={secondary}>(at home)</span>
    </span>
  );
}

/**
 * Official lockup: StudyHallMark + site-typography wordmark.
 * Text is not converted to SVG paths.
 */
export function StudyHallLogo({
  href,
  size = 28,
  variant = "light",
  className,
  textClassName,
  markOnly = false,
}: {
  href?: string;
  size?: number;
  variant?: StudyHallMarkVariant;
  className?: string;
  textClassName?: string;
  /** Product icon without the wordmark. Requires href for an accessible name. */
  markOnly?: boolean;
}) {
  const mark = (
    <StudyHallMark
      size={size}
      variant={variant}
      title={markOnly && !href ? "Study Hall (at home)" : undefined}
    />
  );

  const inner: ReactNode = markOnly ? (
    mark
  ) : (
    <>
      {mark}
      <Wordmark variant={variant} className={textClassName} />
    </>
  );

  const classes = cn("inline-flex items-center gap-2.5", className);

  if (href) {
    return (
      <Link
        href={href}
        className={classes}
        aria-label={markOnly ? "Study Hall (at home)" : undefined}
      >
        {inner}
      </Link>
    );
  }

  return <span className={classes}>{inner}</span>;
}
