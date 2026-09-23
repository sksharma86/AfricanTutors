declare module "@/lib/session-visual-fixture.mjs" {
  import type { SessionRoomPreview } from "@/components/session/session-room";
  import type { SessionInfo } from "@/lib/session-service";

  export const SESSION_ROOM_SCENES: readonly string[];

  export function sessionRoomFixture(
    scene: string,
    nowMs?: number,
  ): { info: SessionInfo; preview: SessionRoomPreview | null; nowMs: number } | null;
}
