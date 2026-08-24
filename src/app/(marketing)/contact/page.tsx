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
    <>
      <PageHeader
        eyebrow="Contact"
        title="We'd love to hear from you."
        description="Questions about Study Hall, pricing, or getting your child started? Send us a message and our team will follow up."
      />

      <Container className="py-16">
        <div className="max-w-xl">
          <ContactForm />
        </div>
      </Container>
    </>
  );
}
