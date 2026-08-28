import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "destructive";
type Size = "sm" | "md" | "lg";

const variantClasses: Record<Variant, string> = {
  primary:
    "border border-transparent bg-ink-900 text-white hover:bg-ink-800 active:bg-ink-900 focus-visible:outline-ink-900",
  secondary:
    "border border-transparent bg-gold-400 text-ink-900 hover:bg-gold-500 active:bg-gold-400 focus-visible:outline-gold-500",
  outline:
    "border border-ink-200 bg-white text-ink-800 hover:border-ink-300 hover:bg-ink-50 active:bg-ink-50 focus-visible:outline-ink-300",
  ghost: "border border-transparent text-ink-600 hover:bg-ink-50 hover:text-ink-900 active:bg-ink-100/60 focus-visible:outline-ink-300",
  destructive:
    "border border-red-300 bg-white text-red-800 hover:border-red-400 hover:bg-red-50 active:bg-red-50 focus-visible:outline-red-400",
};

const sizeClasses: Record<Size, string> = {
  sm: "min-h-11 px-3.5 text-[13px]",
  md: "min-h-11 px-5 text-sm",
  lg: "min-h-12 px-6 text-[15px]",
};

const baseClasses =
  "inline-flex items-center justify-center gap-2 rounded-[12px] font-semibold tracking-[-0.015em] transition-[background-color,border-color,color,transform] duration-200 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:cursor-not-allowed disabled:border-ink-200 disabled:bg-ink-100 disabled:text-ink-400 disabled:shadow-none disabled:opacity-100 active:scale-[0.98]";

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
