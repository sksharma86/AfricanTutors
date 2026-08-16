import type { ElementType, ReactNode } from "react";

import { cn } from "@/lib/utils";

export function Container({
  as: Component = "div",
  className,
  children,
}: {
  as?: ElementType;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Component className={cn("mx-auto w-full max-w-6xl px-6 lg:px-8", className)}>
      {children}
    </Component>
  );
}
