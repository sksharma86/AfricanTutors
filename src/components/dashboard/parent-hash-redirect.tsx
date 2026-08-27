"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Old one-page hashes continue to work after the destination split. */
export function ParentHashRedirect() {
  const router = useRouter();
  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "");
    if (hash === "reports") router.replace("/dashboard/student/reports");
    else if (hash === "account") router.replace("/dashboard/student/account");
    else if (hash === "sessions") router.replace("/dashboard/student/study-halls");
    else if (hash === "prepaid") router.replace("/dashboard/student/packages#prepaid");
  }, [router]);
  return null;
}
