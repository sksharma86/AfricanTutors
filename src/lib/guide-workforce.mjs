/**
 * Derived Guide workforce labels from the existing tutor_status enum
 * (pending | approved | suspended). There is no rejected enum value —
 * a never-approved applicant who was rejected is stored as
 * status=suspended with approved_at null.
 */

export function guideWorkforceLabel(status, approvedAt) {
  if (status === "pending") return "pending";
  if (status === "approved") return "active";
  if (status === "suspended" && !approvedAt) return "rejected";
  if (status === "suspended") return "suspended";
  return "unknown";
}

export function isGuideApplicantStatus(status) {
  return status === "pending" || status === "suspended";
}
