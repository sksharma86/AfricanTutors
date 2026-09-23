/**
 * The Study Hall doorway — a small, lightly playful illustration for the
 * threshold. A hanging lamp over an arched doorway; the lamp comes on when the
 * door is open. Decorative only (aria-hidden); the text next to it carries
 * meaning.
 */
export type DoorState = "closed" | "open" | "ended";

export function StudyHallDoor({ state, className }: { state: DoorState; className?: string }) {
  const lit = state === "open";
  const dim = state === "ended";
  return (
    <svg
      viewBox="0 0 200 180"
      aria-hidden
      data-door-state={state}
      className={className}
      fill="none"
    >
      <defs>
        <radialGradient id="sh-door-glow" cx="50%" cy="0%" r="75%">
          <stop offset="0%" stopColor="#ffe7a8" stopOpacity={lit ? 0.85 : 0.18} />
          <stop offset="45%" stopColor="#f3d27a" stopOpacity={lit ? 0.32 : 0.06} />
          <stop offset="100%" stopColor="#c9a227" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="sh-door-room" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={lit ? "#2a2410" : "#141519"} />
          <stop offset="100%" stopColor={lit ? "#3a3016" : "#0e0f12"} />
        </linearGradient>
      </defs>

      {/* lamp cord + shade */}
      <path d="M100 6v22" stroke="#e8c56a" strokeOpacity={dim ? 0.25 : 0.55} strokeWidth="1.6" />
      <path
        d="M78 40c6-12 38-12 44 0"
        stroke={lit ? "#f3d27a" : "#a8935a"}
        strokeOpacity={dim ? 0.35 : 0.9}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path d="M78 40h44" stroke={lit ? "#f3d27a" : "#a8935a"} strokeOpacity={dim ? 0.35 : 0.9} strokeWidth="2" />
      {/* light cone */}
      <path d="M84 42 L44 168 H156 L116 42 Z" fill="url(#sh-door-glow)" />

      {/* door frame */}
      <path
        d="M60 168 V96 a40 40 0 0 1 80 0 V168"
        stroke={lit ? "#e0c268" : "#6f6a5f"}
        strokeOpacity={dim ? 0.45 : 1}
        strokeWidth="3"
        strokeLinejoin="round"
      />
      {/* room behind the door */}
      <path d="M66 168 V96 a34 34 0 0 1 68 0 V168 Z" fill="url(#sh-door-room)" />

      {/* desk + chair inside */}
      <g stroke={lit ? "#f6f1e8" : "#8c877d"} strokeOpacity={dim ? 0.35 : lit ? 0.95 : 0.7} strokeWidth="2.2" strokeLinecap="round">
        <path d="M74 134h52" />
        <path d="M79 134v22M121 134v22" />
        <path d="M92 146h16" />
        <path d="M100 116v0" />
      </g>
      {lit ? (
        <g fill="#f3d27a" fillOpacity="0.9">
          <rect x="86" y="126" width="12" height="8" rx="1.5" />
          <rect x="102" y="128" width="16" height="6" rx="1.5" />
        </g>
      ) : null}

      {/* threshold / floor */}
      <path d="M36 168h128" stroke={lit ? "#e0c268" : "#4a4640"} strokeOpacity={dim ? 0.5 : 0.9} strokeWidth="2" strokeLinecap="round" />
      {lit ? <ellipse cx="100" cy="171" rx="42" ry="4" fill="#f3d27a" fillOpacity="0.18" /> : null}
    </svg>
  );
}
