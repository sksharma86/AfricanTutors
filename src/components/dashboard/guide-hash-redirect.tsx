"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Legacy hash destinations from the single-page Guide dashboard. */
export function GuideHashRedirect() {
  const router = useRouter();

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "");
    if (hash === "earnings") router.replace("/dashboard/tutor/earnings");
    else if (hash === "availability") router.replace("/dashboard/tutor/availability");
    else if (hash === "study-halls" || hash === "sessions") router.replace("/dashboard/tutor/study-halls");
  }, [router]);

  return null;
}
