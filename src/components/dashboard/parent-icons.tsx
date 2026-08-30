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

export const ParentIconHome = strokeIcon("M4.5 10.2 12 4.5l7.5 5.7V19a1.5 1.5 0 0 1-1.5 1.5h-4.2v-6.2H9.7V20.5H5.5A1.5 1.5 0 0 1 4 19v-8.8Z");
export const ParentIconCalendar = strokeIcon("M7 4.5v2.2M17 4.5v2.2M5 8.2h14M6.2 6.7h11.6A1.7 1.7 0 0 1 19.5 8.4v10.1A1.7 1.7 0 0 1 17.8 20.2H6.2A1.7 1.7 0 0 1 4.5 18.5V8.4A1.7 1.7 0 0 1 6.2 6.7Z M8.2 12.2h3.2M8.2 15.6h7.6");
export const ParentIconReports = strokeIcon("M7.2 4.8h7.1L19 9.4v9.8A1.4 1.4 0 0 1 17.6 20.6H7.2A1.4 1.4 0 0 1 5.8 19.2V6.2A1.4 1.4 0 0 1 7.2 4.8Z M14.2 4.8v4.8H19 M8.6 13.2h6.8M8.6 16.4h4.6");
export const ParentIconPlay = strokeIcon("M8.4 6.8v10.4L18 12 8.4 6.8Z");
export const ParentIconClock = strokeIcon("M12 4.6a7.4 7.4 0 1 1 0 14.8 7.4 7.4 0 0 1 0-14.8Z M12 8.2V12l2.6 1.8");
export const ParentIconAccount = strokeIcon("M12 12.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z M6.2 19.2c.8-2.8 2.9-4.2 5.8-4.2s5 1.4 5.8 4.2");
export const ParentIconCheck = strokeIcon("M5.8 12.2 10 16.4 18.2 8");
export const ParentIconAlert = strokeIcon("M12 8.2v4.6M12 16.6h.01M12 4.8 3.8 19.2h16.4L12 4.8Z");
export const ParentIconChevron = strokeIcon("M9.2 6.8 14.8 12 9.2 17.2");
export const ParentIconBook = strokeIcon("M6.2 5.4h8.4A2.2 2.2 0 0 1 16.8 7.6v11H8.4A2.2 2.2 0 0 0 6.2 20.8V5.4Z M6.2 5.4A2.2 2.2 0 0 0 4 7.6v11");

export const PARENT_NAV_ICONS = {
  Home: ParentIconHome,
  "Study Halls": ParentIconCalendar,
  "Reports & Recordings": ParentIconReports,
  Hours: ParentIconClock,
  Account: ParentIconAccount,
} as const;
