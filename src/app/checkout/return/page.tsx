import type { Metadata } from "next";
import { Suspense } from "react";

import { CheckoutReturnView } from "./return-view";

export const metadata: Metadata = {
  title: "Payment status",
};

export const dynamic = "force-dynamic";

export default function CheckoutReturnPage() {
  return (
    <Suspense fallback={null}>
      <CheckoutReturnView />
    </Suspense>
  );
}
