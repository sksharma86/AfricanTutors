import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { Suspense } from "react";

import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";
import { hostnameFrom, isGuideRecruitmentHost } from "@/lib/guide-host.mjs";

export const metadata: Metadata = {
  title: "Log In",
  description: "Log in to your Study Hall (at home) account.",
};

export default async function LoginPage() {
  const hostHeader = await headers();
  const guideSite = isGuideRecruitmentHost(
    hostnameFrom(hostHeader.get("x-forwarded-host") || hostHeader.get("host")),
  );
  return (
    <AuthCard
      title={guideSite ? "Guide log in" : "Welcome back"}
      description={
        guideSite
          ? "Sign in to your Study Hall Guide portal."
          : "Sign in to your Study Hall (at home) account."
      }
      footer={
        <>
          <Link href="/forgot-password" className="font-medium text-brand-600 hover:underline">
            Forgot your password?
          </Link>
          <span className="mt-2 block">
            {guideSite ? (
              <>
                New to the team?{" "}
                <Link href="/apply-to-tutor" className="font-medium text-brand-600 hover:underline">
                  Become a Guide
                </Link>
              </>
            ) : (
              <>
                Don&apos;t have an account?{" "}
                <Link href="/signup" className="font-medium text-brand-600 hover:underline">
                  Sign up
                </Link>
              </>
            )}
          </span>
        </>
      }
    >
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthCard>
  );
}
