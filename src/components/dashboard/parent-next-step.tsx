import { LinkButton } from "@/components/ui/button";
import { PortalTextLink } from "@/components/ui/portal-text-link";
import { BUY_HOURS_LABEL, FREE_CONVERT_BODY, FREE_CONVERT_HEADLINE } from "@/lib/parent-next-step.mjs";

export function ParentNextStep({
  kind,
  headline,
  body,
  bookLabel,
  bookHref,
  showBuyHours = false,
}: {
  kind: "free_available" | "free_convert" | "repeat" | "none";
  headline?: string | null;
  body?: string | null;
  bookLabel?: string;
  bookHref?: string;
  showBuyHours?: boolean;
}) {
  if (kind !== "free_convert" && kind !== "repeat") return null;
  if (!bookLabel || !bookHref) return null;

  return (
    <div className={kind === "free_convert" ? "rounded-2xl bg-white/80 px-4 py-4 ring-1 ring-ink-900/[0.05] sm:px-5" : ""}>
      {kind === "free_convert" ? (
        <>
          <p className="font-display text-xl font-semibold tracking-[-0.03em] text-ink-900">
            {headline || FREE_CONVERT_HEADLINE}
          </p>
          <p className="mt-1 text-sm text-ink-600">{body || FREE_CONVERT_BODY}</p>
        </>
      ) : null}
      <div className={kind === "free_convert" ? "mt-4 flex flex-wrap items-center gap-3" : "flex flex-wrap items-center gap-3"}>
        <LinkButton href={bookHref} variant={kind === "free_convert" ? "primary" : "outline"} size="sm">
          {bookLabel}
        </LinkButton>
        {showBuyHours ? (
          <PortalTextLink href="/dashboard/student/packages#prepaid">{BUY_HOURS_LABEL}</PortalTextLink>
        ) : null}
      </div>
    </div>
  );
}
