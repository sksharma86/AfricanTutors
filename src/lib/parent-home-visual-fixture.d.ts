declare module "@/lib/parent-home-visual-fixture.mjs" {
  export function parentHomeVisualFixture(now?: Date, opts?: { scene?: string | null }): {
    firstName: string;
    next: import("@/lib/parent-portal-types").ParentBooking | null;
    last: import("@/lib/parent-portal-types").ParentBooking | null;
    lastReport: import("@/lib/parent-portal-types").ParentReport | null;
    lastRecording: import("@/lib/parent-portal-types").ParentRecording | null;
    later: import("@/lib/parent-portal-types").ParentBooking[];
    bookings: import("@/lib/parent-portal-types").ParentBooking[];
    householdTz: string;
    minutes: number;
    creditCents: number;
    preferFreeSession: boolean;
    membership: import("@/lib/parent-week.mjs").ParentMembership;
  };
}
