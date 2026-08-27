export function guideWorkforceLabel(
  status: string | null | undefined,
  approvedAt: string | null | undefined,
): "pending" | "active" | "suspended" | "rejected" | "unknown";

export function isGuideApplicantStatus(status: string | null | undefined): boolean;
