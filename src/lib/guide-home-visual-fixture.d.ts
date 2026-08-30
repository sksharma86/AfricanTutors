declare module "@/lib/guide-home-visual-fixture.mjs" {
  export function guideVisualReviewNow(now?: Date, tz?: string, hour?: number, minute?: number): Date;
  export function guideHomeVisualFixture(
    now?: Date,
    options?: { reportNeeded?: boolean; empty?: boolean },
  ): {
    firstName: string;
    bookings: unknown[];
    availability: unknown[];
    exceptions: unknown[];
    earnings: unknown[];
    reportedBookings: string[];
    reportsReady: boolean;
    timeZone: string;
    nowMs: number;
    currency: string;
    profileStatus: string;
  };
}
