import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "outline" | "ghost";
type Size = "sm" | "md" | "lg";

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-ink-900 text-white hover:bg-ink-800 active:bg-ink-900 focus-visible:outline-ink-900",
  // Gold with near-black text — premium accent, not a sale button.
  secondary:
    "bg-gold-400 text-ink-900 hover:bg-gold-500 active:bg-gold-400 focus-visible:outline-gold-500",
  outline:
    "border border-ink-200/90 bg-transparent text-ink-800 hover:border-ink-300 hover:bg-ink-50/80 active:bg-ink-50 focus-visible:outline-ink-300",
  ghost: "text-ink-700 hover:bg-ink-50/90 active:bg-ink-100/60 focus-visible:outline-ink-300",
};

const sizeClasses: Record<Size, string> = {
  sm: "min-h-9 px-4 text-sm",
  md: "min-h-11 px-5 text-sm",
  lg: "min-h-12 px-7 text-[15px]",
};

const baseClasses =
  "inline-flex items-center justify-center gap-2 rounded-[14px] font-medium tracking-[-0.01em] transition-[background-color,border-color,color,transform,box-shadow] duration-200 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]";

interface CommonProps {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: CommonProps & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(baseClasses, variantClasses[variant], sizeClasses[size], className)}
      {...props}
    >
      {children}
    </button>
  );
}

export function LinkButton({
  variant = "primary",
  size = "md",
  className,
  children,
  href,
  ...props
}: CommonProps &
  AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  return (
    <Link
      href={href}
      className={cn(baseClasses, variantClasses[variant], sizeClasses[size], className)}
      {...props}
    >
      {children}
    </Link>
  );
}
