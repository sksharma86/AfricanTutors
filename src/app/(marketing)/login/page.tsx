import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Log In",
  description: "Log in to your African Tutors account.",
};

export default function LoginPage() {
  return (
    <AuthCard
      title="Welcome back"
      description="Log in to access your dashboard."
      footer={
        <>
          <Link href="/forgot-password" className="font-medium text-brand-600 hover:underline">
            Forgot your password?
          </Link>
          <span className="mt-2 block">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="font-medium text-brand-600 hover:underline">
              Sign up
            </Link>
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
