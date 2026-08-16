import type { TutorStatus } from "@/lib/roles";

const COPY: Record<Exclude<TutorStatus, "approved">, { title: string; body: string; tone: string }> = {
  pending: {
    title: "Your tutor application is under review.",
    body: "Our team reviews new tutor applications by hand. You can still update the information below any time before a decision is made.",
    tone: "border-gold-200 bg-gold-50 text-gold-800",
  },
  rejected: {
    title: "Your tutor application was not approved at this time.",
    body: "This may be revisited in the future. If you have questions, please reach out through our Contact page.",
    tone: "border-ink-200 bg-ink-50 text-ink-700",
  },
  suspended: {
    title: "Your tutor access has been suspended.",
    body: "Please contact our support team through the Contact page for more information.",
    tone: "border-red-200 bg-red-50 text-red-700",
  },
};

export function TutorStatusBanner({ status }: { status: Exclude<TutorStatus, "approved"> }) {
  const { title, body, tone } = COPY[status];

  return (
    <div className={`rounded-2xl border p-5 ${tone}`}>
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-sm leading-6">{body}</p>
    </div>
  );
}
