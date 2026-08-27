/**
 * Study Hall recording retention policy (pure, unit-testable).
 * Single authoritative rule: available for 60 days from ready/completed time.
 */

export const RECORDING_RETENTION_DAYS = 60;

/**
 * @param {string|Date|number|null|undefined} readyAt - completed_at / ready timestamp
 * @returns {Date|null}
 */
export function computeRetentionUntil(readyAt) {
  if (readyAt == null || readyAt === "") return null;
  const d = readyAt instanceof Date ? new Date(readyAt.getTime()) : new Date(readyAt);
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCDate(d.getUTCDate() + RECORDING_RETENTION_DAYS);
  return d;
}

/**
 * @param {string|Date|null|undefined} retentionUntil
 * @param {number} [nowMs]
 */
export function isRetentionExpired(retentionUntil, nowMs = Date.now()) {
  if (!retentionUntil) return false;
  const t = new Date(retentionUntil).getTime();
  if (Number.isNaN(t)) return false;
  return t <= nowMs;
}

/**
 * Playback is allowed only when completed, not deleted, and not past retention.
 *
 * @param {{ status?: string|null, deleted_at?: string|null, retention_until?: string|null, daily_recording_id?: string|null }} row
 * @param {number} [nowMs]
 */
export function isRecordingPlayable(row, nowMs = Date.now()) {
  if (!row) return false;
  if (row.status !== "completed") return false;
  if (!row.daily_recording_id) return false;
  if (row.deleted_at) return false;
  if (isRetentionExpired(row.retention_until, nowMs)) return false;
  return true;
}

/**
 * Parent-facing availability label, e.g. "Available until Oct 24".
 *
 * @param {string|Date|null|undefined} retentionUntil
 * @param {string|null|undefined} [tz]
 */
export function recordingDaysRemaining(retentionUntil, nowMs = Date.now()) {
  if (!retentionUntil) return null;
  const t = new Date(retentionUntil).getTime();
  if (Number.isNaN(t)) return null;
  return Math.ceil((t - nowMs) / 86_400_000);
}

/**
 * Parent-facing remaining window. Policy stays 60 days; this only formats it.
 */
export function recordingAvailabilityLabel(retentionUntil, nowMs = Date.now()) {
  const days = recordingDaysRemaining(retentionUntil, nowMs);
  if (days == null) return "Available for 60 days after the Study Hall.";
  if (days <= 0) return "Recording expired";
  if (days === 1) return "Available for 1 more day";
  return `Available for ${days} more days`;
}

export function formatAvailableUntil(retentionUntil, tz) {
  if (!retentionUntil) return null;
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: tz || "UTC",
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(retentionUntil));
  } catch {
    return new Date(retentionUntil).toISOString().slice(0, 10);
  }
}

/**
 * Cron selection: completed, has Daily id, not deleted, retention_until <= now.
 *
 * @param {{ status?: string|null, deleted_at?: string|null, daily_recording_id?: string|null, retention_until?: string|null }} row
 * @param {number} [nowMs]
 */
export function isDueForRetentionDeletion(row, nowMs = Date.now()) {
  if (!row) return false;
  if (row.status !== "completed") return false;
  if (row.deleted_at) return false;
  if (!row.daily_recording_id) return false;
  if (!row.retention_until) return false;
  return isRetentionExpired(row.retention_until, nowMs);
}
