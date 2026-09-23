declare module "@/lib/session-threshold.mjs" {
  export type ThresholdState = "too_early" | "open" | "too_late" | "not_scheduled" | "not_joinable";

  export function counterpartLabel(
    role: string | undefined,
    counterpart: string | null | undefined,
    childNames?: string[] | null,
  ): string;

  export function thresholdState(
    info: { join_state?: string | null; join_open_at?: string | null; join_close_at?: string | null } | null | undefined,
    nowMs?: number,
  ): ThresholdState | string;

  export function opensInLabel(openAtISO: string | null | undefined, nowMs?: number): string | null;

  export function timeRemaining(
    startISO: string | null | undefined,
    endISO: string | null | undefined,
    nowMs?: number,
  ): { label: string; tone: "normal" | "ending" | "over" } | null;

  export function presenceLine(
    role: string | undefined,
    counterpartPresent: boolean,
    counterpart: string | null | undefined,
    childNames?: string[] | null,
  ): { kind: "waiting" | "together"; headline: string; detail: string };

  export function thresholdCopy(
    state: string,
    role: string | undefined,
    opts?: { statusLabel?: string },
  ): { headline: string; body: string };

  export function exitCopy(
    role: string | undefined,
    bookingId: string,
    opts?: { ended?: boolean; windowOpen?: boolean },
  ): { headline: string; body: string; primary: { href: string; label: string } | null; canRejoin: boolean };

  export const STUDY_HALL_DAILY_THEME: {
    colors: {
      accent: string;
      accentText: string;
      background: string;
      backgroundAccent: string;
      baseText: string;
      border: string;
      mainAreaBg: string;
      mainAreaBgAccent: string;
      mainAreaText: string;
      supportiveText: string;
    };
  };
}
