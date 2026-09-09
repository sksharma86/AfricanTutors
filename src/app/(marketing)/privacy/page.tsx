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
            Our full Privacy Policy is being finalized ahead of public launch. In practice, Study Hall
            at Home keeps sessions on-platform, limits the sharing of personal contact details between
            families and Guides, and records Study Hall sessions for quality and safety. Session
            recordings may be made available to the parent/account holder and are retained for 60 days,
            after which they are deleted according to our retention policy. This wording should receive
            attorney review before public launch.
          </p>
          <p>
            If you provide a phone number, we use it to reach you about your Study Halls, including
            if you are needed during a live session. We do not sell your phone number. Telephony and
            email service providers process the number as needed to deliver those operational
            messages. Guides never see your phone number.
          </p>
          <p>
            Transactional text alerts are sent only if you opt in. They may include reminders, missed
            Study Hall notices, billing attention, and urgent session-related messages. They are not
            marketing. You can turn text alerts off in Account or by texting STOP. Email
            notifications continue either way. Attorney review of this wording is recommended
            before public launch.
          </p>
          <p>
            If you have a question about how your information is handled before our full policy is
            published, please{" "}
            <Link href="/contact" className="font-medium text-gold-700 hover:underline">contact us</Link>.
          </p>
        </div>
      </Container>
    </>
  );
}
