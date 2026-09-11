/**
 * Editorial annotations for the homepage Parent Portal showcase.
 * Presentation follows the approved visual reference; targets are real preview UI.
 * Home is the truthful planning surface in this preview (no Plan My Week control).
 */
export function PortalCallouts() {
  return (
    <div className="sh-home-portal__callouts" aria-hidden>
      <div className="sh-home-portal__note sh-home-portal__note--plan">
        <p className="sh-home-portal__note-title">Plan the week</p>
        <p className="sh-home-portal__note-copy">See what’s coming up and plan Study Halls for the week.</p>
      </div>

      <div className="sh-home-portal__note sh-home-portal__note--join">
        <p className="sh-home-portal__note-title">Join when it’s time</p>
        <p className="sh-home-portal__note-copy">One click to join your child’s Study Hall.</p>
      </div>

      <div className="sh-home-portal__note sh-home-portal__note--review">
        <p className="sh-home-portal__note-title">See how it went</p>
        <p className="sh-home-portal__note-copy">Read the report and watch the recording after each Study Hall.</p>
      </div>

      <svg className="sh-home-portal__arrows" viewBox="0 0 1000 620" fill="none" preserveAspectRatio="none">
        <defs>
          <marker id="sh-gold-head" markerWidth="8" markerHeight="8" refX="6.2" refY="4" orient="auto">
            <path d="M1.2 1.2 L6.6 4 L1.2 6.8 Z" fill="currentColor" />
          </marker>
        </defs>

        {/* Plan the week → Home */}
        <path
          d="M 198 78 C 248 52, 286 58, 318 92"
          stroke="currentColor"
          strokeWidth="2.15"
          strokeLinecap="round"
          markerEnd="url(#sh-gold-head)"
        />

        {/* Join when it’s time → Join Study Hall */}
        <path
          d="M 812 248 C 700 210, 560 228, 498 268"
          stroke="currentColor"
          strokeWidth="2.15"
          strokeLinecap="round"
          markerEnd="url(#sh-gold-head)"
        />

        {/* See how it went → Report ready */}
        <path
          d="M 198 478 C 268 508, 336 498, 392 452"
          stroke="currentColor"
          strokeWidth="2.15"
          strokeLinecap="round"
          markerEnd="url(#sh-gold-head)"
        />
      </svg>
    </div>
  );
}
