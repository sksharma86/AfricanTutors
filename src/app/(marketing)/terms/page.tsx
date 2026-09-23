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
            Study Hall (at home) provides a private, live hour where a child does their own work with a
            Guide present for structure and accountability. By creating an account or booking a Study
            Hall, you agree to these terms.
          </p>
          <p>
            Your first 60-minute Study Hall is free, one per account. After that, one Study Hall is $12,
            ten Study Halls are $99 and do not expire, and Study Hall 365 is $149/month for one hour
            available every calendar day. Prices and what each plan includes are on{" "}
            <Link href="/pricing" className="font-medium text-gold-700 hover:underline">
              pricing
            </Link>{" "}
            and the{" "}
            <Link href="/faq" className="font-medium text-gold-700 hover:underline">
              FAQ
            </Link>
            . Cancel 24 or more hours before a session and the session value returns to your account.
            Cancellations inside 24 hours are non-refundable.
          </p>
          <p>
            Study Hall sessions are recorded. Recordings may be shared with the parent/account holder
            for sessions on their account and are kept for 60 days, then deleted.
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
          </p>
          <p>
            Questions about these terms?{" "}
            <Link href="/contact" className="font-medium text-gold-700 hover:underline">
              Contact us
            </Link>
            .
          </p>
        </div>
      </Container>
    </>
  );
}
