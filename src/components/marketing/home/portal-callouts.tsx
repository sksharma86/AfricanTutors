export function PortalCallouts() {
  return (
    <div className="sh-home-portal__callouts" aria-hidden>
      <div className="sh-home-portal__note sh-home-portal__note--join">
        <span className="sh-home-portal__note-label">Join when it’s time</span>
        <svg className="sh-home-portal__note-arrow" viewBox="0 0 112 58" fill="none">
          <defs>
            <marker
              id="sh-note-head-join"
              markerWidth="6.5"
              markerHeight="6.5"
              refX="5"
              refY="3.25"
              orient="auto"
            >
              <path
                d="M1 1.1 L5.1 3.25 L1 5.4"
                stroke="currentColor"
                strokeWidth="1.35"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </marker>
          </defs>
          <path
            d="M 98 11 C 64 18, 32 30, 11 49"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            markerEnd="url(#sh-note-head-join)"
          />
        </svg>
      </div>

      <div className="sh-home-portal__note sh-home-portal__note--review">
        <span className="sh-home-portal__note-label">See how it went</span>
        <svg className="sh-home-portal__note-arrow" viewBox="0 0 104 54" fill="none">
          <defs>
            <marker
              id="sh-note-head-review"
              markerWidth="6.5"
              markerHeight="6.5"
              refX="5"
              refY="3.25"
              orient="auto"
            >
              <path
                d="M1 1.1 L5.1 3.25 L1 5.4"
                stroke="currentColor"
                strokeWidth="1.35"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </marker>
          </defs>
          <path
            d="M 90 10 C 58 16, 30 28, 10 46"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            markerEnd="url(#sh-note-head-review)"
          />
        </svg>
      </div>
    </div>
  );
}
