import { GUIDE_HANDBOOK_HREF, GUIDE_HANDBOOK_LABEL } from "@/lib/guide-handbook.mjs";
import { cn } from "@/lib/utils";

/** Native download. Next Link client navigation would open the file instead of saving it. */
export function GuideHandbookDownload({ className }: { className?: string }) {
  return (
    <a
      href={GUIDE_HANDBOOK_HREF}
      download
      className={cn(
        "inline-flex min-h-12 items-center justify-center rounded-[12px] bg-ink-900 px-6 text-[15px] font-semibold text-white hover:bg-ink-800",
        className,
      )}
    >
      {GUIDE_HANDBOOK_LABEL}
    </a>
  );
}
