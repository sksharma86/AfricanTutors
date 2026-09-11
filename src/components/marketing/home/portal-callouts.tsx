export function PortalCallouts() {
  return (
    <div className="sh-home-portal__callouts" aria-hidden>
      <span className="sh-home-portal__callout sh-home-portal__callout--plan">Plan the week</span>
      <span className="sh-home-portal__callout sh-home-portal__callout--join">Join when it’s time</span>
      <span className="sh-home-portal__callout sh-home-portal__callout--review">See how it went</span>

      <svg className="sh-home-portal__arrows" viewBox="0 0 1094 607" fill="none" preserveAspectRatio="none">
        <defs>
          <marker
            id="sh-portal-arrowhead"
            markerWidth="7"
            markerHeight="7"
            refX="5.4"
            refY="3.5"
            orient="auto"
          >
            <path
              d="M1 1 L5.6 3.5 L1 6"
              stroke="currentColor"
              strokeWidth="1.15"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </marker>
        </defs>

        {/* Plan the week → Study Halls nav row */}
        <path className="sh-home-portal__arrow-halo" d="M -12 117 C 10 86, 24 96, 42 117" />
        <path
          className="sh-home-portal__arrow"
          d="M -12 117 C 10 86, 24 96, 42 117"
          markerEnd="url(#sh-portal-arrowhead)"
        />

        {/* Join when it’s time → Join Study Hall button */}
        <path className="sh-home-portal__arrow-halo" d="M 1108 295 C 980 208, 560 214, 427 295" />
        <path
          className="sh-home-portal__arrow"
          d="M 1108 295 C 980 208, 560 214, 427 295"
          markerEnd="url(#sh-portal-arrowhead)"
        />

        {/* See how it went → Report ready */}
        <path className="sh-home-portal__arrow-halo" d="M -8 461 C 72 508, 188 498, 268 461" />
        <path
          className="sh-home-portal__arrow"
          d="M -8 461 C 72 508, 188 498, 268 461"
          markerEnd="url(#sh-portal-arrowhead)"
        />
      </svg>
    </div>
  );
}
