import type { Metadata } from "next";
import Link from "next/link";

import { AuthCard } from "@/components/auth/auth-card";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = {
  title: "Reset Password",
  description: "Request a link to reset your Study Hall (at home) password.",
};

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="Forgot your password?"
      description="Enter your email and we'll send you a reset link."
      footer={
        <>
          Remembered it?{" "}
          <Link href="/login" className="font-medium text-gold-700 hover:underline">
            Back to login
          </Link>
        </>
      }
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
