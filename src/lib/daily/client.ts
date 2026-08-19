import "server-only";

import { DAILY_API_KEY, DAILY_DOMAIN, recordingBucketConfig } from "./config";
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
 * early creation misuse. Enables screen share + chat and CLOUD RECORDING so the
 * token-driven auto-start can begin recording on first join. If custom S3 is
 * configured (Mode B), recordings are written to that private bucket; otherwise
 * Daily-managed storage (Mode A) is used.
 */
export async function ensureRoom(name: string, notBeforeUnix: number, notAfterUnix: number): Promise<DailyRoom> {
  const bucket = recordingBucketConfig();
  const body = {
    name,
    privacy: "private",
    properties: {
      enable_screenshare: true,
      enable_chat: true,
      enable_prejoin_ui: true,
      exp: notAfterUnix,
      nbf: notBeforeUnix,
      eject_at_room_exp: true,
      enable_recording: "cloud",
      ...(bucket ? { recordings_bucket: bucket } : {}),
    },
  };
  const res = await dailyFetch("/rooms", { method: "POST", body: JSON.stringify(body) });
  if (res.status === 200) {
    const room = (await res.json()) as { name: string; url: string };
    return { name: room.name, url: room.url };
  }
  // Already exists (concurrent creation / prior join) → fetch and reuse.
  if (res.status === 400 || res.status === 409) {
    const existing = await dailyFetch(`/rooms/${encodeURIComponent(name)}`, { method: "GET" });
    if (existing.ok) {
      const room = (await existing.json()) as { name: string; url: string };
      return { name: room.name, url: room.url };
    }
  }
  throw new DailyUnavailableError();
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
 * after admin authorization). We never store or expose permanent recording URLs.
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
