declare module "@/lib/notifications/whatsapp-copy.mjs" {
  export const WA_TEMPLATES: { attendance: string; replacement: string };
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
  export function whatsappContainsSensitive(text: string | null | undefined): boolean;
}
