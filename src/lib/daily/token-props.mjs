/**
 * Build the Daily meeting-token `properties` for a participant.
 *
 * Recording is MANDATORY and automatic: when `autoStartRecording` is set, the
 * token carries `start_cloud_recording: true` (paired with the room's
 * `enable_recording: "cloud"`), so a cloud recording begins as soon as the first
 * participant joins — no one has to press Record, and empty rooms aren't recorded.
 *
 * Crucially we do NOT put `enable_recording` on participant tokens, so normal
 * students/tutors are never granted recording-management (start/stop) controls —
 * they cannot disable the mandatory recording. Only admins are `is_owner`.
 *
 * Recording is composed 720p (cost-aware, keeps screen-share/documents legible).
 * Pure ESM (+ .d.ts) so the exact token shape is unit-testable.
 */

export const RECORDING_OPTS = { width: 1280, height: 720, fps: 30 };

/**
 * @param {{ room: string, userName: string, userId: string, isOwner: boolean, expUnix: number, autoStartRecording?: boolean }} p
 */
export function buildMeetingTokenProps(p) {
  const props = {
    room_name: p.room,
    user_name: p.userName,
    user_id: p.userId,
    is_owner: Boolean(p.isOwner),
    exp: p.expUnix,
    start_video_off: false,
    start_audio_off: false,
  };
  if (p.autoStartRecording) {
    props.start_cloud_recording = true;
    props.start_cloud_recording_opts = { ...RECORDING_OPTS };
  }
  return props;
}
