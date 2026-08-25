declare module "@/lib/notifications/package-labels.mjs" {
  export function packageHoursLabel(minutes: number | null | undefined): string;
  export function hoursFromMinutes(minutes: number | null | undefined): string;
}
