declare module "@/lib/recording-retention.mjs" {
  export const RECORDING_RETENTION_DAYS: 60;
  export function computeRetentionUntil(readyAt: string | Date | number | null | undefined): Date | null;
  export function isRetentionExpired(retentionUntil: string | Date | null | undefined, nowMs?: number): boolean;
  export function isRecordingPlayable(
    row: {
      status?: string | null;
      deleted_at?: string | null;
      retention_until?: string | null;
      daily_recording_id?: string | null;
    } | null | undefined,
    nowMs?: number,
  ): boolean;
  export function recordingDaysRemaining(
    retentionUntil: string | Date | null | undefined,
    nowMs?: number,
  ): number | null;
  export function recordingAvailabilityLabel(
    retentionUntil: string | Date | null | undefined,
    nowMs?: number,
  ): string;
  export function formatAvailableUntil(
    retentionUntil: string | Date | null | undefined,
    tz?: string | null,
  ): string | null;
  export function isDueForRetentionDeletion(
    row: {
      status?: string | null;
      deleted_at?: string | null;
      daily_recording_id?: string | null;
      retention_until?: string | null;
    } | null | undefined,
    nowMs?: number,
  ): boolean;
}
