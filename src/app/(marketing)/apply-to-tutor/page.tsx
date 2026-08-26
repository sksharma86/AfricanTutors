import type { Metadata } from "next";
import Link from "next/link";

import { AuthCard } from "@/components/auth/auth-card";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata: Metadata = {
  title: "Become a Guide",
  description: "Apply to become a Study Hall (at home) Guide and help families build dependable homework routines.",
};

export default function ApplyToTutorPage() {
  return (
    <AuthCard
      title="Become a Guide with Study Hall (at home)"
      description="Create an account to start your Guide application. Our team reviews every application before granting Guide access."
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
      <SignupForm defaultRole="tutor" submitLabel="Submit Application" />
    </AuthCard>
  );
}
