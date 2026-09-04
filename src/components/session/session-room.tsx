"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { StudyHallMark } from "@/components/brand/study-hall-mark";
import { CameraRequiredBanner } from "@/components/session/camera-required-banner";
import { CallParentControl } from "@/components/session/call-parent-control";
import {
  classifyCameraError,
  classifyLocalVideoTrack,
  localVideoTrackFromParticipants,
  nextCameraPresenceAction,
} from "@/lib/daily/camera-presence.mjs";
import type { SessionInfo } from "@/lib/session-service";
import { formatStudyHallDuration } from "@/lib/studyhall-duration.mjs";
import { customerBookingStatus } from "@/lib/status-labels.mjs";

type Frame = {
  join: (o: { url: string; token?: string }) => Promise<unknown>;
  leave: () => Promise<unknown>;
  destroy: () => void;
  on: (e: string, cb: (ev?: unknown) => void) => void;
  setLocalVideo: (enabled: boolean) => void;
  participants: () => { local?: { tracks?: { video?: unknown } } };
};

function sessionEndedForReport(info: SessionInfo): boolean {
  if (info.status === "cancelled" || info.status === "expired" || info.status === "no_show") return false;
  const end = info.scheduled_end ? Date.parse(info.scheduled_end) : NaN;
  return Number.isFinite(end) && Date.now() >= end;
}

function formatWhen(iso?: string | null): string {
  if (!iso) return "To be scheduled";
  try {
    return new Date(iso).toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function SessionRoom({ bookingId, info }: { bookingId: string; info: SessionInfo }) {
  const router = useRouter();
  const [state, setState] = useState(info.join_state ?? "not_joinable");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inCall, setInCall] = useState(false);
  const [stageOpen, setStageOpen] = useState(false);
  const [cameraWarning, setCameraWarning] = useState<{ title: string; body: string } | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<Frame | null>(null);
  const payloadRef = useRef<{ roomUrl: string; token: string } | null>(null);
  const attachStartedRef = useRef(false);
  const isGuide = info.role === "tutor";

  const leaveBeacon = useCallback(() => {
    try {
      navigator.sendBeacon?.(`/api/session/${bookingId}/leave`);
    } catch {
      /* best-effort */
    }
  }, [bookingId]);

  const teardownFrame = useCallback(() => {
    if (frameRef.current) {
      try {
        frameRef.current.destroy();
      } catch {
        /* ignore */
      }
      frameRef.current = null;
    }
    attachStartedRef.current = false;
    payloadRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      if (frameRef.current) {
        teardownFrame();
        leaveBeacon();
      }
    };
  }, [leaveBeacon, teardownFrame]);

  useEffect(() => {
    if (!stageOpen || !payloadRef.current || attachStartedRef.current) return;
    const node = containerRef.current;
    if (!node) return;
    attachStartedRef.current = true;
    const payload = payloadRef.current;

    void (async () => {
      try {
        const mod = await import("@daily-co/daily-js");
        const DailyIframe = mod.default;
        const existing = (DailyIframe as unknown as { getCallInstance?: () => Frame | null }).getCallInstance?.();
        if (existing) existing.destroy();
        const frame = DailyIframe.createFrame(node, {
          showLeaveButton: true,
          iframeStyle: { width: "100%", height: "100%", border: "0", borderRadius: "16px" },
        }) as unknown as Frame;
        frameRef.current = frame;

        const syncCamera = (classification = classifyLocalVideoTrack(localVideoTrackFromParticipants(frame.participants()))) => {
          const next = nextCameraPresenceAction(classification, info.role);
          setCameraWarning(next.warning);
          if (next.restore) {
            try {
              frame.setLocalVideo(true);
            } catch {
              /* browser / permission may refuse */
            }
          }
        };

        frame.on("joined-meeting", () => {
          syncCamera();
        });
        frame.on("participant-updated", () => {
          syncCamera();
        });
        frame.on("camera-error", () => {
          syncCamera(classifyCameraError());
        });
        frame.on("left-meeting", () => {
          setInCall(false);
          setStageOpen(false);
          setCameraWarning(null);
          leaveBeacon();
          try {
            frame.destroy();
          } catch {
            /* ignore */
          }
          frameRef.current = null;
          attachStartedRef.current = false;
          payloadRef.current = null;
          if (isGuide && sessionEndedForReport(info)) {
            router.push(`/dashboard/tutor/study-halls/${bookingId}/report`);
          }
        });
        await frame.join({ url: payload.roomUrl, token: payload.token });
        setInCall(true);
      } catch {
        teardownFrame();
        setStageOpen(false);
        setCameraWarning(null);
        setError("Could not start the video room. Please try again.");
      } finally {
        setBusy(false);
      }
    })();
  }, [stageOpen, leaveBeacon, teardownFrame, bookingId, info, isGuide, router]);

  async function join() {
    if (busy || stageOpen) return;
    setBusy(true);
    setError(null);
    let res: Response;
    try {
      res = await fetch(`/api/session/${bookingId}/join`, { method: "POST" });
    } catch {
      setBusy(false);
      setError("Network error. Please try again.");
      return;
    }
    const payload = await res.json().catch(() => null);
    if (!res.ok) {
      setBusy(false);
      if (payload?.code === "too_early") setState("too_early");
      else if (payload?.code === "too_late") setState("too_late");
      setError(payload?.error ?? "Unable to join the session.");
      return;
    }
    payloadRef.current = { roomUrl: payload.roomUrl, token: payload.token };
    setStageOpen(true);
  }

  const title = "Study Hall";
  void info.subject;
  const scheduleLine = [
    formatWhen(info.scheduled_start),
    info.scheduled_end ? `– ${formatWhen(info.scheduled_end)}` : null,
    info.duration_minutes ? formatStudyHallDuration(info.duration_minutes) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="overflow-hidden rounded-[20px] border border-white/10 bg-[#12141a]">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 px-5 py-5 sm:px-6">
        <div className="flex items-start gap-3">
          <StudyHallMark size={36} variant="dark" className="mt-0.5" />
          <div>
            <p className="text-xs font-semibold tracking-wide text-gold-300 uppercase">Study Hall (at home) · Live session</p>
            <h1 className="mt-1 font-display text-2xl font-semibold text-white">{title}</h1>
            <p className="mt-1 text-sm text-ink-300">
              {isGuide
                ? Array.isArray(info.child_names) && info.child_names.length > 1
                  ? "Children"
                  : "Child"
                : "Guide"}
              : {info.counterpart ?? "—"}
            </p>
            {isGuide && Array.isArray(info.child_names) && info.child_names.length > 1 ? (
              <p className="mt-0.5 text-sm text-ink-400">{info.child_names.length} children</p>
            ) : null}
            <p className="mt-1 text-sm text-ink-400">{scheduleLine}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/8 px-2.5 py-1 text-xs font-medium text-white/80">
            <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
            Recording
          </span>
          <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-ink-200">
            {customerBookingStatus(info.status ?? "", undefined).label}
          </span>
        </div>
      </div>
      <div className="p-5 sm:p-6">
        {isGuide ? (
          <div className="rounded-lg border border-forest-700/50 bg-forest-950/40 p-3 text-xs leading-5 text-ink-200">
            <p className="font-medium text-forest-200">Guide expectations</p>
            <p className="mt-1">
              Stay present, encourage focus, redirect gently, and keep a calm study environment. Stay visible on camera
              for the whole Study Hall. Do not tutor, teach lessons, or give homework answers. If you need a parent to
              check in physically, use Call Parent — you will never see their phone number.
            </p>
            <div className="mt-3 max-w-sm">
              <CallParentControl bookingId={bookingId} enabled={state === "open" || inCall} />
            </div>
          </div>
        ) : null}

        <div className="mt-4 flex items-start gap-2 rounded-lg border border-ink-700 bg-ink-900/60 p-3 text-xs text-ink-200">
          <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} stroke="currentColor" className="mt-0.5 h-4 w-4 shrink-0 text-gold-300">
            <circle cx="12" cy="12" r="9" />
            <path strokeLinecap="round" d="M12 8h.01M11 12h1v4h1" />
          </svg>
          <span>This Study Hall session is recorded for quality assurance, safety, and dispute resolution.</span>
        </div>

        {isGuide && inCall ? (
          <div className="mt-4">
            <button
              type="button"
              onClick={() => {
                void frameRef.current?.leave();
              }}
              className="rounded-lg border border-white/20 px-4 py-2 text-sm font-medium text-white hover:bg-white/10"
            >
              End Study Hall
            </button>
          </div>
        ) : null}

        <div className="relative mt-6">
          {stageOpen && cameraWarning ? (
            <div className="mb-4">
              <CameraRequiredBanner
                title={cameraWarning.title}
                body={cameraWarning.body}
                variant={isGuide ? "guide" : "student"}
              />
            </div>
          ) : null}
          <div
            ref={containerRef}
            data-daily-mount="true"
            className={
              stageOpen
                ? "h-[70vh] w-full overflow-hidden rounded-2xl bg-black"
                : "pointer-events-none absolute h-0 w-0 overflow-hidden opacity-0"
            }
            aria-hidden={!stageOpen}
          />
          {!stageOpen ? (
            <div className="rounded-2xl border border-ink-700 bg-ink-900 p-8 text-center">
              {state === "open" ? (
                <>
                  <h2 className="font-display text-xl font-semibold text-white">You&apos;re ready to join</h2>
                  <p className="mt-1 text-sm text-ink-300">
                    Camera is required during Study Hall. You can mute your microphone. Screen sharing stays available.
                  </p>
                  {info.videoConfigured === false ? (
                    <p className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200">
                      Video service is not configured in this environment.
                    </p>
                  ) : null}
                  <button
                    onClick={join}
                    disabled={busy}
                    className="mt-6 rounded-xl bg-gold-400 px-6 py-3 font-semibold text-ink-900 hover:bg-gold-300 disabled:opacity-50"
                  >
                    {busy ? "Connecting…" : isGuide ? "Join Study Hall" : "Join session"}
                  </button>
                </>
              ) : state === "too_early" ? (
                <>
                  <h2 className="font-display text-xl font-semibold text-white">Study Hall isn&apos;t open yet</h2>
                  <p className="mt-1 text-sm text-ink-300">
                    Ready to join 5 minutes before start
                    {info.join_open_at ? (
                      <>
                        {" "}
                        (<span className="font-medium text-white">({formatWhen(info.join_open_at)})</span>
                      </>
                    ) : null}
                    .
                  </p>
                  <button
                    onClick={() => location.reload()}
                    className="mt-6 rounded-xl border border-ink-600 px-5 py-2.5 text-sm font-medium text-ink-100 hover:border-ink-400"
                  >
                    Check again
                  </button>
                </>
              ) : state === "too_late" ? (
                <>
                  <h2 className="font-display text-xl font-semibold text-white">This session has ended</h2>
                  <p className="mt-1 text-sm text-ink-300">The room closed 15 minutes after the scheduled end time.</p>
                  {isGuide && sessionEndedForReport(info) ? (
                    <a
                      href={`/dashboard/tutor/study-halls/${bookingId}/report`}
                      className="mt-6 inline-block rounded-xl bg-gold-400 px-6 py-3 font-semibold text-ink-900 hover:bg-gold-300"
                    >
                      Finish report
                    </a>
                  ) : null}
                </>
              ) : state === "not_scheduled" ? (
                <>
                  <h2 className="font-display text-xl font-semibold text-white">No scheduled time yet</h2>
                  <p className="mt-1 text-sm text-ink-300">Our team is still arranging this session.</p>
                </>
              ) : (
                <>
                  <h2 className="font-display text-xl font-semibold text-white">Session not available</h2>
                  <p className="mt-1 text-sm text-ink-300">
                    This session is {customerBookingStatus(info.status ?? "", undefined).label.toLowerCase()}, so the live
                    room is closed.
                  </p>
                </>
              )}
              {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
