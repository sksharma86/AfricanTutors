import { MANAGEMENT_STATUS_LABEL } from "@/lib/management-ops.mjs";
import { cn } from "@/lib/utils";

const TONE: Record<string, string> = {
  ready: "border-ink-200 bg-white text-ink-700",
  live: "border-emerald-300 bg-emerald-50 text-emerald-800",
  needs_attention: "border-gold-300 bg-gold-50 text-gold-800",
  completed: "border-ink-200 bg-[#f4f5f7] text-ink-500",
  cancelled: "border-ink-200 bg-[#f4f5f7] text-ink-400",
};

export function ManagementStatusPill({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold tracking-wide uppercase",
        TONE[status] ?? TONE.needs_attention,
      )}
    >
      {(MANAGEMENT_STATUS_LABEL as Record<string, string>)[status] ?? status}
    </span>
  );
}
