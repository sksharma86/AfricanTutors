import type { Metadata } from "next";
import Link from "next/link";

import { AuthCard } from "@/components/auth/auth-card";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata: Metadata = {
  title: "Sign Up",
  description: "Create your Study Hall (at home) account.",
};

export default function SignupPage() {
  return (
    <AuthCard
      title="Create your account"
      description="Set up a parent account for Study Hall (at home), or apply to become a Guide."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-gold-700 hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <SignupForm />
    </AuthCard>
  );
}
