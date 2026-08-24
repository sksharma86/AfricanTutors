import type { Metadata } from "next";
import Link from "next/link";

import { AuthCard } from "@/components/auth/auth-card";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata: Metadata = {
  title: "Set a New Password",
  description: "Choose a new password for your Study Hall at Home account.",
};

export default function ResetPasswordPage() {
  return (
    <AuthCard
      title="Set a new password"
      description="Choose a new password for your account."
      footer={
        <>
          <Link href="/login" className="font-medium text-brand-600 hover:underline">
            Back to login
          </Link>
        </>
      }
    >
      <ResetPasswordForm />
    </AuthCard>
  );
}
