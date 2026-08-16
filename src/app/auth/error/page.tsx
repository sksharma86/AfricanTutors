import type { Metadata } from "next";

import { AuthCard } from "@/components/auth/auth-card";
import { LinkButton } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Link Expired",
};

export default function AuthErrorPage() {
  return (
    <AuthCard
      title="That link didn't work"
      description="This confirmation or password reset link is invalid or has expired. Links like this are only valid for a limited time and can only be used once."
      footer={null}
    >
      <div className="flex flex-col gap-3">
        <LinkButton href="/forgot-password" variant="primary" className="w-full">
          Request a new link
        </LinkButton>
        <LinkButton href="/login" variant="outline" className="w-full">
          Back to Log In
        </LinkButton>
      </div>
    </AuthCard>
  );
}
