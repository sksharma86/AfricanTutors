import type { Metadata } from "next";
import Link from "next/link";

import { AuthCard } from "@/components/auth/auth-card";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata: Metadata = {
  title: "Get Started",
  description: "Create your African Tutors account and book your student's first tutoring session.",
};

export default function SignupPage() {
  return (
    <AuthCard
      title="Create your student account"
      description="Get started in a minute, then book your student's first session."
      footer={
        <>
          <span>
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-gold-700 hover:underline">
              Log in
            </Link>
          </span>
          <span className="mt-2 block text-ink-400">
            Interested in tutoring with African Tutors?{" "}
            <Link href="/apply-to-tutor" className="font-medium text-gold-700 hover:underline">
              Apply here
            </Link>
            .
          </span>
        </>
      }
    >
      <SignupForm role="student" submitLabel="Create Account" />
    </AuthCard>
  );
}
