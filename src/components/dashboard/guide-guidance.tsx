import { GuideOperatingMethod } from "@/components/dashboard/guide-operating-method";

/** Guide Home operating method. Plan → Focus → Finish + nothing-to-do ladder. */
export function GuideGuidance({
  scheduledStart,
  scheduledEnd,
  nowMs,
}: {
  scheduledStart?: string | null;
  scheduledEnd?: string | null;
  nowMs?: number;
}) {
  return <GuideOperatingMethod scheduledStart={scheduledStart} scheduledEnd={scheduledEnd} nowMs={nowMs} />;
}
