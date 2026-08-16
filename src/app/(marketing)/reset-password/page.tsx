import type { Metadata } from "next";

import { AuthCard } from "@/components/auth/auth-card";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata: Metadata = {
  title: "Reset Password",
};

export default function ResetPasswordPage() {
  return (
    <AuthCard
      title="Choose a new password"
      description="You've followed a password reset link. Enter a new password below."
      footer={null}
    >
      <ResetPasswordForm />
    </AuthCard>
  );
}
