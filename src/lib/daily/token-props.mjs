/**
 * Build the Daily meeting-token `properties` for a participant.
 *
 * Recording is MANDATORY and automatic: when `autoStartRecording` is set, the
 * token carries `start_cloud_recording: true` (paired with the room's
 * `enable_recording: "cloud"`), so a cloud recording begins as soon as the first
 * participant joins — no one has to press Record, and empty rooms aren't recorded.
 *
 * We do NOT put `enable_recording` on participant tokens (that would grant
 * start/stop). Parent/student and Guide tokens also set
 * `enable_recording_ui: false` so Daily Prebuilt does not show Record / Stop
 * Recording, and `permissions.canAdmin: false` so they cannot moderate.
 * Only admins are `is_owner`; their recording chrome is left unset so existing
 * admin support behavior is preserved.
 *
 * Camera starts on (`start_video_off: false`) for every role. Daily cannot
 * require a camera to stay on via token permissions — `canSend` can only
 * withhold video. In-room enforcement lives in session-room + camera-presence.
 *
 * Recording is composed 720p (cost-aware, keeps screen-share/documents legible).
 * Pure ESM (+ .d.ts) so the exact token shape is unit-testable.
 */

export const RECORDING_OPTS = { width: 1280, height: 720, fps: 30 };

/**
 * @param {{ room: string, userName: string, userId: string, isOwner: boolean, expUnix: number, autoStartRecording?: boolean }} p
 */
export function buildMeetingTokenProps(p) {
  const isOwner = Boolean(p.isOwner);
  const props = {
    room_name: p.room,
    user_name: p.userName,
    user_id: p.userId,
    is_owner: isOwner,
    exp: p.expUnix,
    start_video_off: false,
    start_audio_off: false,
  };
  if (p.autoStartRecording) {
    props.start_cloud_recording = true;
    props.start_cloud_recording_opts = { ...RECORDING_OPTS };
  }
  // Normal parent/student and Guide: hide Prebuilt recording chrome and deny
  // admin tasks. Owners (admins) keep the existing elevated token shape.
  if (!isOwner) {
    props.enable_recording_ui = false;
    props.permissions = { canAdmin: false };
  }
  return props;
}
