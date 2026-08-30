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

export const MgmtIconOverview = strokeIcon(
  "M4.8 5.2h6.2v6.2H4.8V5.2Z M13 5.2h6.2v3.6H13V5.2Z M13 11.2h6.2v7.6H13v-7.6Z M4.8 13.8h6.2v5H4.8v-5Z",
);
export const MgmtIconHalls = strokeIcon(
  "M7 4.5v2.2M17 4.5v2.2M5 8.2h14M6.2 6.7h11.6A1.7 1.7 0 0 1 19.5 8.4v10.1A1.7 1.7 0 0 1 17.8 20.2H6.2A1.7 1.7 0 0 1 4.5 18.5V8.4A1.7 1.7 0 0 1 6.2 6.7Z M8.2 12.2h3.2M8.2 15.6h7.6",
);
export const MgmtIconGuides = strokeIcon(
  "M12 11.4a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z M6.2 19.2c.6-3 2.8-4.6 5.8-4.6s5.2 1.6 5.8 4.6",
);
export const MgmtIconCustomers = strokeIcon(
  "M9.2 11.2a2.8 2.8 0 1 0 0-5.6 2.8 2.8 0 0 0 0 5.6Z M4.8 19c.5-2.6 2.3-4 4.4-4s3.9 1.4 4.4 4 M16.4 11.4a2.3 2.3 0 1 0 0-4.6 2.3 2.3 0 0 0 0 4.6Z M15.2 15.4c2.1 0 3.7 1.2 4.2 3.6",
);
export const MgmtIconFinance = strokeIcon(
  "M5.4 8.2h13.2A1.4 1.4 0 0 1 20 9.6v8.2A1.4 1.4 0 0 1 18.6 19.2H5.4A1.4 1.4 0 0 1 4 17.8V9.6A1.4 1.4 0 0 1 5.4 8.2Z M12 12.2v3.6 M10.2 13.4h2.4a1.4 1.4 0 0 1 0 2.8h-1.6",
);

export const MGMT_NAV_ICONS = {
  Overview: MgmtIconOverview,
  "Study Halls": MgmtIconHalls,
  Guides: MgmtIconGuides,
  Customers: MgmtIconCustomers,
  Finance: MgmtIconFinance,
} as const;
