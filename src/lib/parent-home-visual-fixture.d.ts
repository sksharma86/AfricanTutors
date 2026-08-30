declare module "@/lib/parent-home-visual-fixture.mjs" {
  export function parentHomeVisualFixture(now?: Date): {
    firstName: string;
    next: import("@/lib/parent-portal-types").ParentBooking;
    last: import("@/lib/parent-portal-types").ParentBooking;
    lastReport: import("@/lib/parent-portal-types").ParentReport;
    lastRecording: import("@/lib/parent-portal-types").ParentRecording;
    later: import("@/lib/parent-portal-types").ParentBooking[];
    bookings: import("@/lib/parent-portal-types").ParentBooking[];
    householdTz: string;
    minutes: number;
    creditCents: number;
    preferFreeSession: boolean;
  };
}
