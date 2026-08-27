/**
 * Daily room properties for Study Hall (at home) sessions.
 *
 * Chat is a room capability (not a token flag). It is disabled for every
 * session room so Prebuilt does not offer chat to parent/student or Guide.
 *
 * Cloud recording stays enabled at the room so `start_cloud_recording` on
 * meeting tokens can auto-start the mandatory safety recording. Default
 * non-owner permissions deny admin tasks (participants / streaming /
 * transcription). Meeting owners (admins only) keep owner privileges.
 *
 * Pure ESM (+ .d.ts) so tests can assert the exact room shape.
 */

/** Capability fields applied on create and re-applied when a room is reused. */
export const ROOM_PARTICIPANT_PROPERTIES = {
  enable_screenshare: true,
  enable_chat: false,
  enable_prejoin_ui: true,
  enable_recording: "cloud",
  eject_at_room_exp: true,
  permissions: { canAdmin: false },
};

/**
 * @param {{ notBeforeUnix: number, notAfterUnix: number, recordingsBucket?: object | null }} p
 */
export function buildRoomProperties(p) {
  return {
    ...ROOM_PARTICIPANT_PROPERTIES,
    exp: p.notAfterUnix,
    nbf: p.notBeforeUnix,
    ...(p.recordingsBucket ? { recordings_bucket: p.recordingsBucket } : {}),
  };
}
