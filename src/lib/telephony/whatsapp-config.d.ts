declare module "@/lib/telephony/whatsapp-config.mjs" {
  export function getWhatsAppConfig(): {
    accountSid: string;
    authToken: string;
    from: string;
    attendanceContentSid: string;
    replacementContentSid: string;
    openCoverageContentSid: string;
    disabled: boolean;
  };
  export function isWhatsAppConfigured(): boolean;
}
