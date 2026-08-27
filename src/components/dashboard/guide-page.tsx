import type { ReactNode } from "react";

import { GuideShell } from "@/components/dashboard/guide-shell";
import { cn } from "@/lib/utils";

export function GuidePage({
  children,
  wide = false,
}: {
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <GuideShell>
      <div className={cn("mx-auto w-full px-5 py-7 sm:px-6 sm:py-10", wide ? "max-w-4xl" : "max-w-3xl")}>
        {children}
      </div>
    </GuideShell>
  );
}
