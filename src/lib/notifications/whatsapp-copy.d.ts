declare module "@/lib/notifications/whatsapp-copy.mjs" {
  export const WA_TEMPLATES: { attendance: string; replacement: string; openCoverage: string };
  export function labeledTime(iso: string | null | undefined, tz: string | null | undefined): string;
  export function guidePortalUrl(appUrl: string | null | undefined): string;
  export function guideAttendanceWhatsApp(ctx?: {
    count?: number;
    startISO?: string | null;
    endISO?: string | null;
    tz?: string | null;
    durationMinutes?: number | null;
    studentName?: string | null;
    appUrl?: string | null;
    replacement?: boolean;
  }): {
    template: string;
    variables: Record<string, string>;
    body: string;
    count: number;
    start: string;
    end: string;
    url: string;
  };
  export function guideOpenCoverageWhatsApp(ctx?: {
    startISO?: string | null;
    endISO?: string | null;
    tz?: string | null;
    durationMinutes?: number | null;
    appUrl?: string | null;
    acceptPath?: string | null;
  }): {
    template: string;
    variables: Record<string, string>;
    body: string;
    start: string;
    end: string;
    duration: string;
    url: string;
  };
  export function whatsappContainsSensitive(text: string | null | undefined): boolean;
}
