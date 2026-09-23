"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { StudyHallMark } from "@/components/brand/study-hall-mark";
import { CameraRequiredBanner } from "@/components/session/camera-required-banner";
import { CallParentControl } from "@/components/session/call-parent-control";
import { GuideCustomerNoShowControl } from "@/components/session/guide-customer-no-show-control";
import { StudyHallDoor, type DoorState } from "@/components/session/study-hall-door";
import { GuideOperatingMethod } from "@/components/dashboard/guide-operating-method";
import {
  classifyCameraError,
  classifyLocalVideoTrack,
  localVideoTrackFromParticipants,
  nextCameraPresenceAction,
} from "@/lib/daily/camera-presence.mjs";
import type { SessionInfo } from "@/lib/session-service";
import {
  STUDY_HALL_DAILY_THEME,
  counterpartLabel,
  exitCopy,
  opensInLabel,
  presenceLine,
  thresholdCopy,
  thresholdState,
  timeRemaining,
} from "@/lib/session-threshold.mjs";
import { GUIDE_METHOD_PHASES, guideMethodPhase } from "@/lib/guide-operating-method.mjs";
import { formatStudyHallDuration } from "@/lib/studyhall-duration.mjs";
import { customerBookingStatus } from "@/lib/status-labels.mjs";

type DailyParticipantLike = { local?: boolean; user_id?: string; tracks?: { video?: unknown } };

type Frame = {
  join: (o: { url: string; token?: string }) => Promise<unknown>;
  leave: () => Promise<unknown>;
  destroy: () => void;
  on: (e: string, cb: (ev?: unknown) => void) => void;
  setLocalVideo: (enabled: boolean) => void;
  participants: () => Record<string, DailyParticipantLike>;
};

/**
 * Visual-review only. Seeds the room into an in-call or post-call state without
 * loading Daily. Never set from a production route.
 */
export type SessionRoomPreview = "waiting" | "live" | "left" | "left-early";

function sessionEndedForReport(info: SessionInfo, nowMs = Date.now()): boolean {
  if (info.status === "cancelled" || info.status === "expired" || info.status === "no_show") return false;
  const end = info.scheduled_end ? Date.parse(info.scheduled_end) : NaN;
  return Number.isFinite(end) && nowMs >= end;
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

function formatDay(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}

function formatClock(iso?: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  } catch {
    return iso;
  }
}

/** The counterpart is identified by the role baked into their Daily token (user_id). */
function counterpartInRoom(participants: Record<string, DailyParticipantLike>, isGuide: boolean): boolean {
  const want = isGuide ? "student" : "tutor";
  return Object.values(participants ?? {}).some((p) => !p.local && p.user_id === want);
}

export function SessionRoom({
  bookingId,
  info,
  studentJoinedAt = null,
  preview = null,
  nowMs,
}: {
  bookingId: string;
  info: SessionInfo;
  studentJoinedAt?: string | null;
  preview?: SessionRoomPreview | null;
  /** Pins the clock for fixtures; production leaves it undefined. */
  nowMs?: number;
}) {
  const router = useRouter();
  const isGuide = info.role === "tutor";
  const [liveNow, setLiveNow] = useState(() => Date.now());
  const now = nowMs ?? liveNow;

  // Server response can pin the door (too_early / too_late) regardless of the local clock.
  const [serverState, setServerState] = useState<string | null>(null);
  const state = serverState ?? thresholdState(info, now);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inCall, setInCall] = useState(preview === "waiting" || preview === "live");
  const [stageOpen, setStageOpen] = useState(preview === "waiting" || preview === "live");
  const [counterpartPresent, setCounterpartPresent] = useState(preview === "live");
  const [left, setLeft] = useState<{ ended: boolean } | null>(
    preview === "left" ? { ended: true } : preview === "left-early" ? { ended: false } : null,
  );
  const [cameraWarning, setCameraWarning] = useState<{ title: string; body: string } | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<Frame | null>(null);
  const payloadRef = useRef<{ roomUrl: string; token: string } | null>(null);
  const attachStartedRef = useRef(false);

  // Live clock: 15s ticks plus exact wake-ups at door-open and scheduled end so
  // the doorway opens itself without a reload.
  useEffect(() => {
    if (nowMs != null) return;
    const tick = () => setLiveNow(Date.now());
    const interval = window.setInterval(tick, 15_000);
    const timeouts: number[] = [];
    for (const iso of [info.join_open_at, info.scheduled_end, info.join_close_at]) {
      if (!iso) continue;
      const delay = Date.parse(iso) - Date.now();
      if (Number.isFinite(delay) && delay > 0 && delay < 24 * 3600_000) {
        timeouts.push(window.setTimeout(tick, delay + 50));
      }
    }
    return () => {
      window.clearInterval(interval);
      timeouts.forEach((t) => window.clearTimeout(t));
    };
  }, [nowMs, info.join_open_at, info.scheduled_end, info.join_close_at]);

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
          showFullscreenButton: true,
          theme: STUDY_HALL_DAILY_THEME,
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
        const syncPresence = () => {
          try {
            setCounterpartPresent(counterpartInRoom(frame.participants(), isGuide));
          } catch {
            /* participants() can throw during teardown */
          }
        };

        frame.on("joined-meeting", () => {
          syncCamera();
          syncPresence();
        });
        frame.on("participant-joined", syncPresence);
        frame.on("participant-left", syncPresence);
        frame.on("participant-updated", () => {
          syncCamera();
          syncPresence();
        });
        frame.on("camera-error", () => {
          syncCamera(classifyCameraError());
        });
        frame.on("left-meeting", () => {
          const ended = sessionEndedForReport(info);
          setInCall(false);
          setStageOpen(false);
          setCameraWarning(null);
          setCounterpartPresent(false);
          leaveBeacon();
          try {
            frame.destroy();
          } catch {
            /* ignore */
          }
          frameRef.current = null;
          attachStartedRef.current = false;
          payloadRef.current = null;
          if (isGuide && ended) {
            router.push(`/dashboard/tutor/study-halls/${bookingId}/report`);
            return;
          }
          setLeft({ ended });
        });
        await frame.join({ url: payload.roomUrl, token: payload.token });
        setInCall(true);
      } catch {
        teardownFrame();
        setStageOpen(false);
        setCameraWarning(null);
        setError("Could not open the Study Hall room. Please try again.");
      } finally {
        setBusy(false);
      }
    })();
  }, [stageOpen, leaveBeacon, teardownFrame, bookingId, info, isGuide, router]);

  async function join() {
    if (busy || stageOpen || preview) return;
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
      if (payload?.code === "too_early") setServerState("too_early");
      else if (payload?.code === "too_late") setServerState("too_late");
      setError(payload?.error ?? "Unable to join the Study Hall.");
      return;
    }
    payloadRef.current = { roomUrl: payload.roomUrl, token: payload.token };
    setLeft(null);
    setServerState(null);
    setStageOpen(true);
  }

  const who = counterpartLabel(info.role, info.counterpart, info.child_names);
  const whoLine = isGuide
    ? Array.isArray(info.child_names) && info.child_names.length > 1
      ? `${info.child_names.join(", ")} · ${info.child_names.length} children`
      : `Child: ${info.counterpart ?? "—"}`
    : `with ${who}`;
  const scheduleLine = [
    info.scheduled_start ? formatDay(info.scheduled_start) : "To be scheduled",
    info.scheduled_start
      ? `${formatClock(info.scheduled_start)}${info.scheduled_end ? ` – ${formatClock(info.scheduled_end)}` : ""}`
      : null,
    info.duration_minutes ? formatStudyHallDuration(info.duration_minutes) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const remaining = timeRemaining(info.scheduled_start, info.scheduled_end, now);
  const presence = presenceLine(info.role, counterpartPresent, info.counterpart, info.child_names);
  const windowOpen = state === "open";
  const ended = sessionEndedForReport(info, now);
  const statusLabel = customerBookingStatus(info.status ?? "", undefined).label;
  const door = thresholdCopy(state, info.role, { statusLabel });
  const opensIn = opensInLabel(info.join_open_at, now);
  const doorState: DoorState = state === "open" ? "open" : state === "too_late" ? "ended" : "closed";

  const pill = useMemo(() => {
    if (left) return { tone: "muted" as const, label: left.ended ? "Ended" : "Stepped out" };
    if (stageOpen) {
      if (presence.kind === "together") return { tone: "live" as const, label: remaining ? `In progress · ${remaining.label}` : "In progress" };
      return { tone: "wait" as const, label: presence.headline };
    }
    if (state === "open") return { tone: "live" as const, label: "Door open" };
    if (state === "too_early") return { tone: "wait" as const, label: `Opens at ${formatClock(info.join_open_at)}` };
    if (state === "too_late") return { tone: "muted" as const, label: "Ended" };
    return { tone: "muted" as const, label: statusLabel };
  }, [left, stageOpen, presence.kind, presence.headline, remaining, state, info.join_open_at, statusLabel]);

  const backHref = isGuide ? "/dashboard/tutor" : "/dashboard/student";
  const exit = left ? exitCopy(info.role, bookingId, { ended: left.ended, windowOpen }) : null;
  const phase = guideMethodPhase(info.scheduled_start, info.scheduled_end, now);
  const phaseTitle = GUIDE_METHOD_PHASES.find((p) => p.id === phase)?.title ?? null;
  const methodSummary = phaseTitle ? `Plan → Focus → Finish · now: ${phaseTitle}` : "Plan → Focus → Finish";
  const title = "Study Hall";

  return (
    <div className="sh-room overflow-hidden rounded-[24px] border border-white/10 text-[#f3eee5]" data-room-state={left ? "left" : stageOpen ? "in-room" : state}>
      <div className="sh-room__atmosphere" aria-hidden />
      <header className="relative flex flex-wrap items-start justify-between gap-3 border-b border-white/10 px-5 py-5 sm:px-6">
        <div className="flex items-start gap-3">
          <StudyHallMark size={40} variant="dark" className="mt-0.5" />
          <div>
            <p className="text-[11px] font-semibold tracking-[0.16em] text-gold-300 uppercase">Study Hall (at home)</p>
            <h1 className="mt-1 font-display text-2xl font-semibold tracking-[-0.02em] text-white">{title}</h1>
            <p className="mt-1 text-sm text-white/72">{whoLine}</p>
            <p className="mt-0.5 text-sm text-white/50">{scheduleLine}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {inCall ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/8 px-2.5 py-1 text-xs font-medium text-white/80">
              <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
              Recording
            </span>
          ) : null}
          <span data-kind="room-pill" data-tone={pill.tone} className="sh-room__pill inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium">
            <span className="sh-room__dot h-1.5 w-1.5 rounded-full" />
            {pill.label}
          </span>
        </div>
      </header>

      <div className="relative p-5 sm:p-6">
        {stageOpen ? (
          <div className={isGuide ? "lg:grid lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start lg:gap-5" : undefined}>
            <div className="min-w-0">
              <div
                data-kind="presence"
                data-presence={presence.kind}
                className="sh-room__presence mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <span className={presence.kind === "together" ? "sh-room__presence-dot is-together" : "sh-room__presence-dot"} aria-hidden />
                  <div>
                    <p className="text-[15px] font-semibold text-white">{presence.headline}</p>
                    <p className="text-[13px] text-white/60">{presence.detail}</p>
                  </div>
                </div>
                {remaining ? (
                  <p className={remaining.tone === "ending" ? "text-sm font-medium text-gold-200" : "text-sm text-white/60"}>
                    {remaining.label}
                    {info.scheduled_end ? <span className="text-white/40"> · ends {formatClock(info.scheduled_end)}</span> : null}
                  </p>
                ) : null}
              </div>
              {cameraWarning ? (
                <div className="mb-4">
                  <CameraRequiredBanner title={cameraWarning.title} body={cameraWarning.body} variant={isGuide ? "guide" : "student"} />
                </div>
              ) : null}
              <div ref={containerRef} data-daily-mount="true" className="sh-room__stage h-[70vh] w-full overflow-hidden rounded-2xl bg-black">
                {preview ? (
                  <div className="flex h-full items-center justify-center text-center">
                    <div>
                      <p className="text-sm font-medium text-white/80">Video stage</p>
                      <p className="mt-1 text-xs text-white/45">Fixture placeholder. Daily Prebuilt is not mounted here.</p>
                    </div>
                  </div>
                ) : null}
              </div>
              <p className="mt-3 text-xs text-white/45">
                This Study Hall session is recorded for quality assurance, safety, and dispute resolution.
              </p>
            </div>
            {isGuide ? (
              <aside className="mt-5 space-y-3 lg:mt-0" aria-label="Guide tools">
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-[10px] font-semibold tracking-[0.14em] text-gold-300 uppercase">Guide tools</p>
                  <p className="mt-2 text-[12.5px] leading-5 text-white/65">
                    Stay visible on camera. If a parent is needed, use Call Parent — you will never see their number.
                  </p>
                  <div className="mt-3">
                    <CallParentControl bookingId={bookingId} enabled={windowOpen || inCall} />
                  </div>
                  <div className="mt-3">
                    <GuideCustomerNoShowControl
                      bookingId={bookingId}
                      status={info.status ?? ""}
                      scheduledStart={info.scheduled_start ?? null}
                      studentJoinedAt={counterpartPresent ? (studentJoinedAt ?? new Date(now).toISOString()) : studentJoinedAt}
                      callParentEnabled={windowOpen || inCall}
                      includeCallParent={false}
                      variant="session"
                      nowMs={nowMs}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      void frameRef.current?.leave();
                    }}
                    disabled={!inCall}
                    className="mt-4 w-full rounded-xl border border-white/20 px-4 py-2.5 text-sm font-medium text-white hover:bg-white/10 disabled:opacity-40"
                  >
                    End Study Hall
                  </button>
                </div>
                <details className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 open:pb-4">
                  <summary className="cursor-pointer text-[13px] font-medium text-white">{methodSummary}</summary>
                  <div className="mt-3">
                    <GuideOperatingMethod scheduledStart={info.scheduled_start} scheduledEnd={info.scheduled_end} nowMs={nowMs} tone="session" />
                  </div>
                </details>
              </aside>
            ) : null}
          </div>
        ) : (
          <div className="sh-room__door relative overflow-hidden rounded-2xl border border-white/10 px-6 py-9 text-center sm:px-10">
            <StudyHallDoor state={exit ? (exit.canRejoin ? "open" : "ended") : doorState} className="mx-auto h-[150px] w-[168px]" />
            {exit ? (
              <>
                <h2 className="mt-4 font-display text-[1.65rem] font-semibold tracking-[-0.02em] text-white">{exit.headline}</h2>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/65">{exit.body}</p>
                <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                  {exit.canRejoin ? (
                    <button
                      type="button"
                      onClick={join}
                      disabled={busy}
                      className="rounded-xl bg-gold-400 px-6 py-3 font-semibold text-ink-900 hover:bg-gold-300 disabled:opacity-50"
                    >
                      {busy ? "Opening the door…" : "Rejoin Study Hall"}
                    </button>
                  ) : null}
                  {exit.primary ? (
                    <Link
                      href={exit.primary.href}
                      className={
                        exit.canRejoin
                          ? "rounded-xl border border-white/20 px-5 py-3 text-sm font-medium text-white hover:bg-white/10"
                          : "rounded-xl bg-gold-400 px-6 py-3 font-semibold text-ink-900 hover:bg-gold-300"
                      }
                    >
                      {exit.primary.label} →
                    </Link>
                  ) : null}
                  <Link href={backHref} className="text-sm font-medium text-white/60 hover:text-white">
                    Back to Home
                  </Link>
                </div>
              </>
            ) : (
              <>
                {state === "too_early" && opensIn ? (
                  <p className="mt-3 text-[11px] font-semibold tracking-[0.16em] text-gold-300 uppercase">{opensIn}</p>
                ) : state === "open" ? (
                  <p className="mt-3 text-[11px] font-semibold tracking-[0.16em] text-gold-300 uppercase">
                    {isGuide ? `Waiting for ${who}` : `${who} will meet you inside`}
                  </p>
                ) : null}
                <h2 className="mt-2 font-display text-[1.65rem] font-semibold tracking-[-0.02em] text-white">{door.headline}</h2>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/65">{door.body}</p>

                {state === "open" ? (
                  <>
                    {info.videoConfigured === false ? (
                      <p className="mx-auto mt-4 max-w-md rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200">
                        Video service is not configured in this environment.
                      </p>
                    ) : null}
                    <button
                      onClick={join}
                      disabled={busy}
                      className="mt-6 rounded-xl bg-gold-400 px-7 py-3.5 text-[15px] font-semibold text-ink-900 shadow-[0_12px_30px_-14px_rgba(201,162,39,0.8)] hover:bg-gold-300 disabled:opacity-50"
                    >
                      {busy ? "Opening the door…" : "Join Study Hall"}
                    </button>
                    <p className="mx-auto mt-4 max-w-md text-xs leading-5 text-white/50">
                      Camera stays on. You can mute your microphone. Screen sharing stays available.
                    </p>
                  </>
                ) : state === "too_early" ? (
                  <p className="mt-5 text-sm text-white/60">
                    Ready to join 5 minutes before start
                    {info.join_open_at ? (
                      <>
                        {" "}
                        · <span className="font-medium text-white">{formatWhen(info.join_open_at)}</span>
                      </>
                    ) : null}
                    . This page opens the door on its own — no need to refresh.
                  </p>
                ) : state === "too_late" ? (
                  <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                    {isGuide && ended ? (
                      <Link
                        href={`/dashboard/tutor/study-halls/${bookingId}/report`}
                        className="rounded-xl bg-gold-400 px-6 py-3 font-semibold text-ink-900 hover:bg-gold-300"
                      >
                        Finish report →
                      </Link>
                    ) : null}
                    {!isGuide ? (
                      <Link
                        href={`/dashboard/student/study-halls/${bookingId}`}
                        className="rounded-xl bg-gold-400 px-6 py-3 font-semibold text-ink-900 hover:bg-gold-300"
                      >
                        See what happened →
                      </Link>
                    ) : null}
                    <Link href={backHref} className="text-sm font-medium text-white/60 hover:text-white">
                      Back to Home
                    </Link>
                  </div>
                ) : null}
              </>
            )}
            {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}
          </div>
        )}

        {!stageOpen ? (
          <>
            <p className="mt-4 text-xs text-white/40">
              This Study Hall session is recorded for quality assurance, safety, and dispute resolution.
            </p>
            {isGuide && !left ? (
              <details className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4" open={state !== "too_late" || undefined}>
                <summary className="cursor-pointer text-[13px] font-medium text-white">{methodSummary}</summary>
                <div className="mt-3">
                  <GuideOperatingMethod scheduledStart={info.scheduled_start} scheduledEnd={info.scheduled_end} nowMs={nowMs} tone="session" />
                </div>
              </details>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
