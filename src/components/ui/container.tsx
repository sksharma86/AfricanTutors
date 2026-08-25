import type { ElementType, ReactNode } from "react";

import { cn } from "@/lib/utils";

type ContainerSize = "default" | "narrow" | "wide" | "full";

const sizeClass: Record<ContainerSize, string> = {
  default: "max-w-6xl",
  narrow: "max-w-3xl",
  wide: "max-w-7xl",
  full: "max-w-[90rem]",
};

export function Container({
  as: Component = "div",
  size = "default",
  className,
  children,
}: {
  as?: ElementType;
  size?: ContainerSize;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Component className={cn("mx-auto w-full px-6 lg:px-8", sizeClass[size], className)}>
      {children}
    </Component>
  );
}
