import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/marketing/page-header";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Study Hall (at home) Terms of Service.",
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
            Study Hall sessions are recorded. Recordings may be shared with the parent/account holder
            for sessions on their account and are kept for 60 days, then deleted. Attorney review of
            this wording is recommended before public launch.
          </p>
          <p>
            During an active Study Hall, we may contact the phone number on your account by
            automated voice call if a Guide needs you to check on your child. That operational
            voice contact is separate from text messages.
          </p>
          <p>
            If you opt in to Study Hall text alerts, we may send transactional/service texts about
            your Study Halls — for example upcoming reminders, missed Study Halls, billing
            attention, and urgent session-related messages. These are not promotional or marketing
            texts. Consent is optional and is not required to use Study Hall. Message and data rates
            may apply. You can change this preference in Account, or text STOP to our number. If you
            previously texted STOP, reply START to that number as well so texts can resume.
            Attorney review of this wording is recommended before public launch.
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
