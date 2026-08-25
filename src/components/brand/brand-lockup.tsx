import Link from "next/link";

import { BrandMark } from "@/components/brand/brand-mark";
import { cn } from "@/lib/utils";

/**
 * Clean product monogram for public marketing — avoids leading with the
 * legacy Africa + graduation-cap mark. The original BrandMark asset is
 * preserved and still available via `variant="legacy"`.
 */
function ProductMark({ size = 28 }: { size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-flex items-center justify-center rounded-[9px] bg-ink-900 text-white"
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 24 24" className="h-[55%] w-[55%]" fill="none">
        <path
          d="M6 17V7.8c0-.4.2-.7.5-.9L12 4l5.5 2.9c.3.2.5.5.5.9V17"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M9.5 17v-4.2h5V17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

/**
 * Brand lockup. Marketing defaults to the product monogram + wordmark.
 * Pass `variant="legacy"` to show the historic Africa mark (dashboards, etc.).
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
  return (
    <Link href={href} className={cn("flex items-center gap-2.5", className)}>
      {variant === "legacy" ? <BrandMark size={size} priority={priority} /> : <ProductMark size={size} />}
      <span
        className={cn(
          "text-[15px] font-semibold tracking-[-0.03em] text-ink-900 sm:text-base",
          textClassName,
        )}
      >
        Study Hall <span className="font-medium text-ink-500">at Home</span>
      </span>
    </Link>
  );
}
