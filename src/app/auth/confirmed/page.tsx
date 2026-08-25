import type { Metadata } from "next";
import Link from "next/link";

import { AuthCard } from "@/components/auth/auth-card";
import { ResendConfirmationForm } from "@/components/auth/resend-confirmation-form";
import { LinkButton } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Email confirmation",
  description: "Confirm your Study Hall at Home account.",
};

export default async function AuthConfirmedPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; reason?: string }>;
}) {
  const { status, reason } = await searchParams;
  const isError = status === "error";
  const isConfirmedNoSession = status === "confirmed";

  if (isError) {
    const expired = reason === "expired";
    return (
      <AuthCard
        title={expired ? "This confirmation link has expired" : "This confirmation link is no longer valid"}
        description={
          expired
            ? "Request a new confirmation email, or sign in if you already confirmed your account."
            : "The link may have already been used, or it isn’t valid anymore. You can request a new email or sign in."
        }
        footer={
          <>
            Already confirmed?{" "}
            <Link href="/login" className="font-medium text-gold-700 hover:underline">
              Sign in
            </Link>
          </>
        }
      >
        <div className="space-y-4">
          <ResendConfirmationForm />
          <LinkButton href="/login" variant="outline" className="w-full">
            Sign in
          </LinkButton>
        </div>
      </AuthCard>
    );
  }

  if (isConfirmedNoSession) {
    return (
      <AuthCard
        title="Email confirmed"
        description="Your email is confirmed. Sign in to continue to your Study Hall account."
        footer={
          <>
            Need an account?{" "}
            <Link href="/signup" className="font-medium text-gold-700 hover:underline">
              Create one
            </Link>
          </>
        }
      >
        <LinkButton href="/login" variant="primary" className="w-full" size="lg">
          Sign in
        </LinkButton>
      </AuthCard>
    );
  }

  // Default / unknown — point people to sign in rather than the homepage.
  return (
    <AuthCard
      title="Confirm your email"
      description="Check your inbox for a confirmation link from Study Hall at Home. After you confirm, you’ll be signed in automatically when possible."
      footer={
        <>
          Already confirmed?{" "}
          <Link href="/login" className="font-medium text-gold-700 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <div className="space-y-4">
        <ResendConfirmationForm />
        <LinkButton href="/login" variant="outline" className="w-full">
          Sign in
        </LinkButton>
      </div>
    </AuthCard>
  );
}
