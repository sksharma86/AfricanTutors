/**
 * Platform roles.
 *
 * Role assignment is never client-chosen. "student" is granted at signup.
 * "tutor" access is only unlocked after an administrator approves a tutor
 * application (see tutor_profiles.status in DATABASE.md). "admin" accounts
 * are provisioned directly by the platform owner/engineering team and are
 * never selectable through public signup. See DECISIONS.md and
 * ARCHITECTURE.md for the reasoning behind this.
 */
export type Role = "student" | "tutor" | "admin";

/** Role a visitor may request at signup. Does not grant elevated access by itself. */
export type RequestableRole = "student" | "tutor";

export const DASHBOARD_PATH_BY_ROLE: Record<Role, string> = {
  student: "/dashboard/student",
  tutor: "/dashboard/tutor",
  admin: "/dashboard/admin",
};
