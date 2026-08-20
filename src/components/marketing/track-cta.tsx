"use client";

import Link from "next/link";
import type { AnchorHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";
import { ANALYTICS_EVENTS, track } from "@/lib/analytics";

type Variant = "primary" | "secondary" | "outline" | "ghost";
type Size = "sm" | "md" | "lg";

const variantClasses: Record<Variant, string> = {
  primary: "bg-ink-900 text-white hover:bg-ink-800 focus-visible:outline-ink-900",
  secondary: "bg-gold-400 text-ink-900 hover:bg-gold-500 focus-visible:outline-gold-500",
  outline: "border border-ink-200 text-ink-800 hover:border-ink-300 hover:bg-ink-50 focus-visible:outline-ink-300",
  ghost: "text-ink-700 hover:bg-ink-50 focus-visible:outline-ink-300",
};
const sizeClasses: Record<Size, string> = {
  sm: "px-3.5 py-1.5 text-sm",
  md: "px-5 py-2.5 text-sm",
  lg: "px-6 py-3.5 text-base",
};
const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";

/**
 * A LinkButton that emits a `cta_click` analytics event (with a `cta` label and
 * `location`) before navigating. Used for the primary acquisition CTAs.
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
      className={cn(base, variantClasses[variant], sizeClasses[size], className)}
      {...props}
    >
      {children}
    </Link>
  );
}
