import "server-only";

import { DAILY_API_KEY, DAILY_DOMAIN, recordingBucketConfig } from "./config";
import { ROOM_PARTICIPANT_PROPERTIES, buildRoomProperties } from "./room-props.mjs";
import { buildMeetingTokenProps } from "./token-props.mjs";

/**
 * Minimal server-side Daily REST client (no secret ever reaches the browser).
 * We use the REST API directly rather than a server SDK: create/reuse private
 * rooms and mint short-lived meeting tokens scoped to a single room + participant.
 */
const API = "https://api.daily.co/v1";

/** Thrown when Daily is unavailable/misconfigured so callers can return 503. */
export class DailyUnavailableError extends Error {
  constructor(message = "Video service is temporarily unavailable.") {
    super(message);
    this.name = "DailyUnavailableError";
  }
}

async function dailyFetch(path: string, init: RequestInit): Promise<Response> {
  if (!DAILY_API_KEY) throw new DailyUnavailableError("Daily is not configured.");
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${DAILY_API_KEY}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
      cache: "no-store",
    });
  } catch {
    throw new DailyUnavailableError();
  }
  return res;
}

export interface DailyRoom {
  name: string;
  url: string;
}

/**
 * Create (or reuse) a private room with a deterministic name so concurrent join
 * requests converge on ONE room. Room auto-expires at `notAfterUnix`; nbf gates
 * early creation misuse. Chat is disabled; screen share + prejoin stay on;
 * CLOUD RECORDING stays on so token-driven auto-start can begin recording on
 * first join. If custom S3 is configured (Mode B), recordings are written to
 * that private bucket; otherwise Daily-managed storage (Mode A) is used.
 *
 * On reuse, participant capabilities are re-applied so rooms created before
 * chat/recording-UI restrictions do not keep the old Prebuilt controls.
 */
export async function ensureRoom(name: string, notBeforeUnix: number, notAfterUnix: number): Promise<DailyRoom> {
  const bucket = recordingBucketConfig();
  const body = {
    name,
    privacy: "private",
    properties: buildRoomProperties({
      notBeforeUnix,
      notAfterUnix,
      recordingsBucket: bucket,
    }),
  };
  const res = await dailyFetch("/rooms", { method: "POST", body: JSON.stringify(body) });
  if (res.status === 200) {
    const room = (await res.json()) as { name: string; url: string };
    return { name: room.name, url: room.url };
  }
  // Already exists (concurrent creation / prior join) → fetch, tighten, reuse.
  if (res.status === 400 || res.status === 409) {
    const existing = await dailyFetch(`/rooms/${encodeURIComponent(name)}`, { method: "GET" });
    if (existing.ok) {
      const room = (await existing.json()) as { name: string; url: string };
      await applyRoomParticipantProperties(name);
      return { name: room.name, url: room.url };
    }
  }
  throw new DailyUnavailableError();
}

/**
 * Best-effort re-apply of chat-off / cloud-recording / non-owner permission
 * defaults on an already-created room. Failure is not fatal to join.
 */
async function applyRoomParticipantProperties(name: string): Promise<void> {
  try {
    await dailyFetch(`/rooms/${encodeURIComponent(name)}`, {
      method: "POST",
      body: JSON.stringify({ properties: ROOM_PARTICIPANT_PROPERTIES }),
    });
  } catch {
    // best-effort; join still proceeds with the existing room
  }
}

/**
 * Widen an existing room's access bounds (used for admin support access when the
 * room was created for the normal window). Best-effort: failure to update is not
 * fatal to the join, so we swallow non-OK responses.
 */
export async function updateRoomBounds(name: string, notBeforeUnix: number, notAfterUnix: number): Promise<void> {
  try {
    await dailyFetch(`/rooms/${encodeURIComponent(name)}`, {
      method: "POST",
      body: JSON.stringify({ properties: { nbf: notBeforeUnix, exp: notAfterUnix } }),
    });
  } catch {
    // best-effort; the room may already permit access
  }
}

/** Deterministic room URL for a room name (used as a fallback). */
export function roomUrl(name: string): string {
  return `https://${DAILY_DOMAIN}.daily.co/${name}`;
}

export interface TokenParams {
  room: string;
  userName: string;
  userId: string;
  isOwner: boolean;
  expUnix: number;
  /** When true, cloud recording auto-starts as this participant joins. */
  autoStartRecording?: boolean;
}

/** Mint a short-lived meeting token scoped to one room + participant. */
export async function createMeetingToken(p: TokenParams): Promise<string> {
  const res = await dailyFetch("/meeting-tokens", {
    method: "POST",
    body: JSON.stringify({ properties: buildMeetingTokenProps(p) }),
  });
  if (!res.ok) throw new DailyUnavailableError();
  const data = (await res.json()) as { token: string };
  return data.token;
}

export interface RecordingAccess {
  url: string;
  expiresAt: string;
}

/**
 * Generate a SHORT-LIVED access link for a cloud recording (server-side only,
 * after authorization). We never store or expose permanent recording URLs.
 */
export async function getRecordingAccessLink(recordingId: string): Promise<RecordingAccess | null> {
  const res = await dailyFetch(`/recordings/${encodeURIComponent(recordingId)}/access-link`, { method: "GET" });
  if (!res.ok) return null;
  const data = (await res.json()) as { download_link?: string; expires?: number };
  if (!data.download_link) return null;
  return {
    url: data.download_link,
    expiresAt: new Date((data.expires ? data.expires * 1000 : Date.now() + 15 * 60000)).toISOString(),
  };
}

export interface DeleteRecordingResult {
  status: "deleted" | "failed" | "skipped";
  error?: string | null;
}

/**
 * Permanently delete a cloud recording from Daily. Used by the 60-day retention
 * cron after authorization. Never throws — returns structured results.
 */
export async function deleteDailyRecording(recordingId: string): Promise<DeleteRecordingResult> {
  if (!recordingId) return { status: "skipped", error: "no recording id" };
  if (!DAILY_API_KEY) return { status: "skipped", error: "Daily is not configured." };
  try {
    const res = await dailyFetch(`/recordings/${encodeURIComponent(recordingId)}`, { method: "DELETE" });
    if (res.ok || res.status === 404) {
      // 404: already gone at provider — treat as deleted so we can mark DB.
      return { status: "deleted" };
    }
    const detail = await res.text().catch(() => "");
    return { status: "failed", error: `daily ${res.status} ${detail.slice(0, 200)}` };
  } catch (e) {
    return { status: "failed", error: e instanceof Error ? e.message : "delete error" };
  }
}
