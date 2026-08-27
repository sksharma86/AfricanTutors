import { MANAGEMENT_STATUS_LABEL } from "@/lib/management-ops.mjs";
import { cn } from "@/lib/utils";

const TONE: Record<string, string> = {
  ready: "text-ink-600",
  live: "font-semibold text-emerald-800",
  needs_attention: "font-semibold text-ink-800",
  completed: "text-ink-400",
  cancelled: "text-ink-400",
};

export function ManagementStatusLabel({ status }: { status: string }) {
  return (
    <span className={cn("text-sm", TONE[status] ?? TONE.needs_attention)}>
      {(MANAGEMENT_STATUS_LABEL as Record<string, string>)[status] ?? status}
    </span>
  );
}

/** @deprecated Prefer ManagementStatusLabel — kept so existing imports keep compiling. */
export function ManagementStatusPill({ status }: { status: string }) {
  return <ManagementStatusLabel status={status} />;
}
