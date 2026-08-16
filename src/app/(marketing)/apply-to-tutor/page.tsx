import type { Metadata } from "next";
import Link from "next/link";

import { AuthCard } from "@/components/auth/auth-card";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata: Metadata = {
  title: "Apply to Tutor",
  description: "Apply to join the African Tutors network of qualified academic tutors.",
};

export default function ApplyToTutorPage() {
  return (
    <AuthCard
      title="Apply to tutor with African Tutors"
      description="Create an account to start your tutor application. Our team reviews every application before granting tutor access."
      footer={
        <>
          Looking to book tutoring for a student instead?{" "}
          <Link href="/signup" className="font-medium text-gold-700 hover:underline">
            Create a student account
          </Link>
          .
        </>
      }
    >
      <SignupForm defaultRole="tutor" submitLabel="Submit Application" />
    </AuthCard>
  );
}
