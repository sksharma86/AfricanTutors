import { GuideOperatingMethod } from "@/components/dashboard/guide-operating-method";

/** Guide Home operating method. Plan → Focus → Finish + nothing-to-do ladder. */
export function GuideGuidance({
  scheduledStart,
  scheduledEnd,
  nowMs,
  ladderOpen = false,
}: {
  scheduledStart?: string | null;
  scheduledEnd?: string | null;
  nowMs?: number;
  ladderOpen?: boolean;
}) {
  return (
    <GuideOperatingMethod
      scheduledStart={scheduledStart}
      scheduledEnd={scheduledEnd}
      nowMs={nowMs}
      ladderOpen={ladderOpen}
    />
  );
}
