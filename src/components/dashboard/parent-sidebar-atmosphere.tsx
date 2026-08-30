/** Abstract brand panel — no product functionality, no photos. */
export function ParentSidebarAtmosphere() {
  return (
    <div
      aria-hidden
      className="relative mb-4 overflow-hidden rounded-[16px] bg-[#161c18] px-3.5 py-3.5"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_80%_20%,rgba(201,162,39,0.28),transparent_52%),radial-gradient(ellipse_at_10%_110%,rgba(201,162,39,0.1),transparent_46%)]" />
      <svg viewBox="0 0 120 56" className="relative h-14 w-full" fill="none">
        <ellipse cx="92" cy="14" rx="18" ry="10" fill="#c9a227" opacity="0.22" />
        <path d="M18 44c8-14 18-20 30-14 10 5 16 2 22-6" stroke="#e8d5a0" strokeWidth="1.2" opacity="0.55" />
        <rect x="14" y="38" width="28" height="4" rx="1.5" fill="#c9a227" opacity="0.35" />
        <rect x="46" y="40" width="18" height="3" rx="1.5" fill="#f3e6c4" opacity="0.28" />
      </svg>
      <p className="relative mt-1 text-[11px] leading-4 tracking-[0.01em] text-[#f3e6c4]/72">
        Calm, focused evenings.
      </p>
    </div>
  );
}
