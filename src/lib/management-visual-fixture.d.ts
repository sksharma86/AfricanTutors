declare module "@/lib/management-visual-fixture.mjs" {
  export function managementVisualReviewNow(now?: Date, tz?: string, hour?: number, minute?: number): Date;
  export function managementHomeVisualFixture(
    now?: Date,
    options?: { empty?: boolean; scene?: string | null },
  ): {
    bookings: unknown[];
    presenceByBooking: Record<string, object>;
    attentionItems: unknown[];
    guidesActive: number;
    outstandingTotals: { currency: string; earned: number; paid: number; outstanding: number }[];
    guides: unknown[];
    reports: unknown[];
    payments: unknown[];
    nowMs: number;
    timeZone: string;
  };
}
