import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/marketing/page-header";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Study Hall (at home) Privacy Policy.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <>
      <PageHeader eyebrow="Legal" title="Privacy Policy" />
      <Container className="py-16">
        <div className="max-w-2xl space-y-4 text-base leading-7 text-ink-600">
          <p>
            Study Hall (at home) keeps sessions on-platform. We use your account information to run
            Study Halls: who is booked, when, and how to reach the parent if a Guide needs them during
            the hour. We do not sell personal information.
          </p>
          <p>
            Sessions are recorded for quality and safety. Session recordings may be made available to
            the parent/account holder and are retained for 60 days, after which they are deleted.
            Guides do not receive parent phone numbers or personal contact details.
          </p>
          <p>
            If you provide a phone number, we use it to reach you about your Study Halls, including
            if you are needed during a live session. Telephony and email providers process that
            number only as needed to deliver those operational messages.
          </p>
          <p>
            Transactional text alerts are sent only if you opt in. They may include reminders, missed
            Study Hall notices, billing attention, and urgent session-related messages. They are not
            marketing. You can turn text alerts off in Account or by texting STOP. Email
            notifications continue either way.
          </p>
          <p>
            Questions about your information?{" "}
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
