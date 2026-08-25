import type { Metadata } from "next";

import { ContactForm } from "@/components/marketing/contact-form";
import { PageHeader } from "@/components/marketing/page-header";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get in touch with the Study Hall at Home team.",
};

export default function ContactPage() {
  return (
    <div className="mkt-atmosphere">
      <PageHeader
        eyebrow="Contact"
        title="We’re here to help."
        description="Questions about Study Hall, pricing, or getting started? Send a message — we’ll follow up."
      />

      <Container size="wide" className="pb-16 sm:pb-20">
        <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
          <div className="max-w-sm">
            <p className="text-[15px] leading-7 text-ink-500">
              We typically respond within one business day. For account or session issues, signing in
              to your parent account is often fastest.
            </p>
          </div>
          <div className="max-w-lg">
            <ContactForm />
          </div>
        </div>
      </Container>
    </div>
  );
}
