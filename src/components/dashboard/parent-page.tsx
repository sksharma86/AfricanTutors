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
      <div className={cn("mx-auto w-full px-5 py-7 sm:px-6 sm:py-9", wide ? "max-w-3xl" : "max-w-2xl")}>
        {children}
      </div>
    </CustomerShell>
  );
}
