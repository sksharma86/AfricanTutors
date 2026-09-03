/**
 * Persistent in-room camera warning. Not a toast — stays until video returns.
 */
export function CameraRequiredBanner({
  title,
  body,
  variant = "student",
}: {
  title: string;
  body: string;
  variant?: "guide" | "student";
}) {
  const tone =
    variant === "guide"
      ? "border-gold-400/70 bg-[#2a2110] text-[#F6F1E8]"
      : "border-gold-300/55 bg-[#1d2218] text-[#F6F1E8]";

  return (
    <div
      role="alert"
      aria-live="assertive"
      data-camera-warning={variant}
      className={`rounded-2xl border px-4 py-4 shadow-[0_10px_28px_-18px_rgba(0,0,0,0.65)] sm:px-5 sm:py-5 ${tone}`}
    >
      <p className="text-[11px] font-semibold tracking-[0.14em] text-gold-300 uppercase">{title}</p>
      <p className="mt-2 text-[15px] leading-6 text-white sm:text-base">{body}</p>
    </div>
  );
}
