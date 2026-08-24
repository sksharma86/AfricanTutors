import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/marketing/page-header";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Study Hall at Home Terms of Service.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <>
      <PageHeader eyebrow="Legal" title="Terms of Service" />
      <Container className="py-16">
        <div className="max-w-2xl space-y-4 text-base leading-7 text-ink-600">
          <p>
            Our full Terms of Service are being finalized ahead of public launch. In the meantime,
            key policies are described in plain language across this site — including{" "}
            <Link href="/pricing" className="font-medium text-gold-700 hover:underline">pricing</Link>,
            the free trial, non-expiring package hours, and our cancellation policy on the{" "}
            <Link href="/faq" className="font-medium text-gold-700 hover:underline">FAQ</Link>.
          </p>
          <p>
            If you have a question about our terms before then, please{" "}
            <Link href="/contact" className="font-medium text-gold-700 hover:underline">contact us</Link>.
          </p>
        </div>
      </Container>
    </>
  );
}
