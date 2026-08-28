import type { ReactNode } from "react";

import { CustomerShell } from "@/components/dashboard/customer-shell";
import { cn } from "@/lib/utils";

export function ParentPage({
  children,
  wide = false,
}: {
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <CustomerShell>
      <div className={cn("mx-auto w-full px-5 py-6 sm:px-6 sm:py-7", wide ? "max-w-4xl" : "max-w-3xl")}>
        {children}
      </div>
    </CustomerShell>
  );
}
