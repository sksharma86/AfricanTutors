import type { Metadata } from "next";

import { ContactForm } from "@/components/marketing/contact-form";
import { PageHeader } from "@/components/marketing/page-header";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get in touch with the African Tutors team.",
};

export default function ContactPage() {
  return (
    <>
      <PageHeader
        eyebrow="Contact"
        title="We'd love to hear from you."
        description="Questions about tutoring, pricing, or getting your student started? Send us a message and our team will follow up."
      />

      <Container className="py-16">
        <div className="max-w-xl">
          <ContactForm />
        </div>
      </Container>
    </>
  );
}
