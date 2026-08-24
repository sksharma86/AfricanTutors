import { Container } from "@/components/ui/container";

const SIGNALS = [
  "Approved Guides",
  "Sessions recorded for quality & safety",
  "Secure payments",
  "Flexible online booking",
];

export function TrustRow() {
  return (
    <div className="border-b border-ink-100 bg-white">
      <Container className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 py-5">
        {SIGNALS.map((label) => (
          <span key={label} className="inline-flex items-center gap-2 text-sm text-ink-600">
            <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.9} stroke="currentColor" className="h-4 w-4 text-forest-500">
              <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
            </svg>
            {label}
          </span>
        ))}
      </Container>
    </div>
  );
}
