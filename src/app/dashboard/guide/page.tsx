import { redirect } from "next/navigation";

/**
 * Clean alias for the approved Guide workspace.
 * Internal route `/dashboard/tutor` remains the canonical path (role gating + RLS).
 */
export default function GuideDashboardAliasPage() {
  redirect("/dashboard/tutor");
}
