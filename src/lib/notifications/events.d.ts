declare module "@/lib/notifications/events.mjs" {
  export const NOTIFICATION_EVENTS: Readonly<Record<string, string>>;
  export const CHANNEL_POLICY: Readonly<{
    email: string[];
    sms: string[];
    voice: string[];
    guide_reassigned_success?: Readonly<{
      parent: string[];
      newGuide: string[];
      removedGuide: string[];
      manager: string[];
    }>;
  }>;
}
