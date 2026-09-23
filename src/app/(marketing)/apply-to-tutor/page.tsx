import type { Metadata } from "next";
import Link from "next/link";

import { AuthCard } from "@/components/auth/auth-card";
import { GuideApplicationForm } from "@/components/auth/guide-application-form";

export const metadata: Metadata = {
  title: "Become a Guide",
  description: "Apply to become a Study Hall (at home) Guide and help families keep a dependable academic hour.",
};

export default function ApplyToTutorPage() {
  return (
    <AuthCard
      title="Become a Guide with Study Hall (at home)"
      description="Tell us your name, email, and WhatsApp number. Our team reviews every application before granting Guide access. Submitting does not approve you or open hours."
      footer={
        <>
          Looking to book Study Hall for your child instead?{" "}
          <Link href="/signup" className="font-medium text-gold-700 hover:underline">
            Create a parent account
          </Link>
          .
        </>
      }
    >
      <GuideApplicationForm />
    </AuthCard>
  );
}
