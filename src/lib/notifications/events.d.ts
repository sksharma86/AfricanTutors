declare module "@/lib/notifications/events.mjs" {
  export const NOTIFICATION_EVENTS: Readonly<Record<string, string>>;
  export const CHANNEL_POLICY: Readonly<{
    email: string[];
    whatsapp?: string[];
    sms: string[];
    voice: string[];
    guide_reassigned_success?: Readonly<{
      parent: string[];
      newGuide: string[];
      removedGuide: string[];
      manager: string[];
    }>;
    pr7_lifecycle?: Readonly<
      Record<
        string,
        Readonly<{
          parent: string[];
          guide: string[];
          manager: string[];
        }>
      >
    >;
    pr7d_customer_no_show?: Readonly<{
      parent: string[];
      guide: string[];
      manager: string[];
    }>;
  }>;
}
