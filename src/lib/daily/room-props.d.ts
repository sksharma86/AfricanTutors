export const ROOM_PARTICIPANT_PROPERTIES: {
  enable_screenshare: true;
  enable_chat: false;
  enable_prejoin_ui: true;
  enable_recording: "cloud";
  eject_at_room_exp: true;
  permissions: { canAdmin: false };
};

export function buildRoomProperties(p: {
  notBeforeUnix: number;
  notAfterUnix: number;
  recordingsBucket?: Record<string, unknown> | null;
}): Record<string, unknown>;
