import { cn } from "@/lib/utils";

type IconProps = { className?: string };

function strokeIcon(path: string) {
  return function Icon({ className }: IconProps) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        className={cn("h-[18px] w-[18px] shrink-0", className)}
      >
        <path d={path} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  };
}

export const GuideIconHome = strokeIcon("M4.5 10.2 12 4.5l7.5 5.7V19a1.5 1.5 0 0 1-1.5 1.5h-4.2v-6.2H9.7V20.5H5.5A1.5 1.5 0 0 1 4 19v-8.8Z");
export const GuideIconCalendar = strokeIcon("M7 4.5v2.2M17 4.5v2.2M5 8.2h14M6.2 6.7h11.6A1.7 1.7 0 0 1 19.5 8.4v10.1A1.7 1.7 0 0 1 17.8 20.2H6.2A1.7 1.7 0 0 1 4.5 18.5V8.4A1.7 1.7 0 0 1 6.2 6.7Z M8.2 12.2h3.2M8.2 15.6h7.6");
export const GuideIconClock = strokeIcon("M12 4.6a7.4 7.4 0 1 1 0 14.8 7.4 7.4 0 0 1 0-14.8Z M12 8.2V12l2.6 1.8");
export const GuideIconEarnings = strokeIcon("M5.4 8.2h13.2A1.4 1.4 0 0 1 20 9.6v8.2A1.4 1.4 0 0 1 18.6 19.2H5.4A1.4 1.4 0 0 1 4 17.8V9.6A1.4 1.4 0 0 1 5.4 8.2Z M7.2 8.2V6.8A2.4 2.4 0 0 1 9.6 4.4h4.8A2.4 2.4 0 0 1 16.8 6.8v1.4 M12 12.2v3.6 M10.2 13.4h2.4a1.4 1.4 0 0 1 0 2.8h-1.6");
export const GuideIconChevron = strokeIcon("M9.2 6.8 14.8 12 9.2 17.2");

export const GUIDE_NAV_ICONS = {
  Home: GuideIconHome,
  "Study Halls": GuideIconCalendar,
  Availability: GuideIconClock,
  Earnings: GuideIconEarnings,
} as const;
