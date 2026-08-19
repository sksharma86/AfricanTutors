export const RECORDING_OPTS: { width: number; height: number; fps: number };
export function buildMeetingTokenProps(p: {
  room: string;
  userName: string;
  userId: string;
  isOwner: boolean;
  expUnix: number;
  autoStartRecording?: boolean;
}): Record<string, unknown>;
