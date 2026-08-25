"use client";

import Link from "next/link";
import type { AnchorHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";
import { ANALYTICS_EVENTS, track } from "@/lib/analytics";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "text";
type Size = "sm" | "md" | "lg";

const variantClasses: Record<Variant, string> = {
  primary: "bg-ink-900 text-white hover:bg-ink-800 active:bg-ink-900 focus-visible:outline-ink-900",
  secondary: "bg-gold-400 text-ink-900 hover:bg-gold-500 active:bg-gold-400 focus-visible:outline-gold-500",
  outline:
    "border border-ink-200/90 text-ink-800 hover:border-ink-300 hover:bg-white/50 focus-visible:outline-ink-300",
  ghost: "text-ink-700 hover:bg-ink-50/90 focus-visible:outline-ink-300",
  text: "text-ink-600 underline-offset-4 hover:text-ink-900 hover:underline focus-visible:outline-ink-300",
};
const sizeClasses: Record<Size, string> = {
  sm: "min-h-9 px-4 text-sm",
  md: "min-h-11 px-5 text-sm",
  lg: "min-h-12 px-7 text-[15px]",
};
const base =
  "inline-flex items-center justify-center gap-2 rounded-[14px] font-medium tracking-[-0.01em] transition-[background-color,border-color,color,transform] duration-200 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-[0.98]";

/**
 * Link that emits a `cta_click` analytics event before navigating.
 */
export function TrackCta({
  href,
  cta,
  location,
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: {
  href: string;
  cta: string;
  location: string;
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
} & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href">) {
  return (
    <Link
      href={href}
      onClick={() => track(ANALYTICS_EVENTS.ctaClick, { cta, location })}
      className={cn(
        variant === "text" ? "inline-flex items-center gap-1 font-medium transition-colors duration-200" : base,
        variantClasses[variant],
        variant !== "text" ? sizeClasses[size] : "text-[15px]",
        className,
      )}
      {...props}
    >
      {children}
    </Link>
  );
}
