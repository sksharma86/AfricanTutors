import { cn } from "@/lib/utils";

const SIGNALS: { label: string; icon: React.ReactNode }[] = [
  {
    label: "Approved Guides",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} stroke="currentColor" className="h-4 w-4">
        <circle cx="12" cy="12" r="9" />
        <path strokeLinecap="round" strokeLinejoin="round" d="m8.5 12 2.5 2.5 4.5-5" />
      </svg>
    ),
  },
  {
    label: "Sessions recorded for quality & safety",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} stroke="currentColor" className="h-4 w-4">
        <rect x="3.5" y="6" width="12" height="12" rx="2.5" />
        <path strokeLinecap="round" strokeLinejoin="round" d="m15.5 10 5-2.5v9L15.5 14" />
      </svg>
    ),
  },
  {
    label: "Secure payments",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} stroke="currentColor" className="h-4 w-4">
        <rect x="4.5" y="10" width="15" height="9" rx="2" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 10V8a4 4 0 0 1 8 0v2" />
      </svg>
    ),
  },
];

export function TrustSignals({ className }: { className?: string }) {
  return (
    <ul className={cn("flex flex-wrap items-center gap-x-6 gap-y-2", className)}>
      {SIGNALS.map((s) => (
        <li key={s.label} className="inline-flex items-center gap-2 text-sm text-ink-500">
          <span className="text-forest-500">{s.icon}</span>
          {s.label}
        </li>
      ))}
    </ul>
  );
}
