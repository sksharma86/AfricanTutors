import { StudyHallMark } from "@/components/brand/study-hall-mark";

/**
 * Live-room chrome for film. Does not mount Daily or Call Parent APIs.
 */
export function FilmSessionChrome({
  showCallParent = false,
}: {
  showCallParent?: boolean;
}) {
  return (
    <div className="min-h-svh bg-[#0b0d10] px-8 py-10">
      <div className="mx-auto max-w-5xl overflow-hidden rounded-[20px] border border-white/10 bg-[#12141a]">
        <div className="flex items-start justify-between gap-3 border-b border-white/10 px-6 py-5">
          <div className="flex items-start gap-3">
            <StudyHallMark size={36} variant="dark" className="mt-0.5" />
            <div>
              <p className="text-xs font-semibold tracking-wide text-gold-300 uppercase">
                Study Hall (at home) · Live session
              </p>
              <h1 className="mt-1 font-display text-2xl font-semibold text-white">Study Hall</h1>
              <p className="mt-1 text-sm text-ink-300">Child: Jordan</p>
              <p className="mt-1 text-sm text-ink-400">Friday · 6:30 PM–7:30 PM · 1 hour</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/8 px-2.5 py-1 text-xs font-medium text-white/80">
              <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
              Recording
            </span>
            <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-ink-200">
              Confirmed
            </span>
          </div>
        </div>
        <div className="p-6">
          <div className="rounded-lg border border-forest-700/50 bg-forest-950/40 p-3 text-xs leading-5 text-ink-200">
            <p className="font-medium text-forest-200">Guide expectations</p>
            <p className="mt-1">
              Stay present, encourage focus, redirect gently, and keep a calm study environment. Stay visible
              on camera for the whole Study Hall. Do not tutor, teach lessons, or give homework answers. If you
              need a parent to check in physically, use Call Parent — you will never see their phone number.
            </p>
            {showCallParent ? (
              <div className="mt-3 max-w-sm rounded-xl border border-ink-600 bg-ink-900 p-3 text-left">
                <p className="text-xs font-semibold text-ink-100">Request parent attention?</p>
                <p className="mt-1 text-[11px] leading-4 text-ink-400">
                  This will call the parent immediately. If they do not answer, we text them. You will not see
                  their number.
                </p>
                <p className="mt-3 text-[10px] font-medium tracking-wide text-ink-400 uppercase">Reason</p>
                <p className="mt-1 text-xs text-ink-200">Needs a parent check-in</p>
                <div className="mt-3 flex gap-2">
                  <span className="flex-1 rounded-lg bg-gold-400 px-3 py-1.5 text-center text-xs font-semibold text-ink-900">
                    Call Parent
                  </span>
                  <span className="rounded-lg border border-ink-600 px-3 py-1.5 text-xs text-ink-300">Cancel</span>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-[11px] text-ink-400">Call Parent is available while this Study Hall is active.</p>
            )}
          </div>
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-ink-700 bg-ink-900/60 p-3 text-xs text-ink-200">
            <span>This Study Hall session is recorded for quality assurance, safety, and dispute resolution.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
