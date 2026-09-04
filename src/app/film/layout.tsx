import type { ReactNode } from "react";

import { assertFilmCapture } from "@/lib/film/guard";

export const metadata = {
  title: "Study Hall film capture",
  robots: { index: false, follow: false },
};

export default function FilmLayout({ children }: { children: ReactNode }) {
  assertFilmCapture();
  return (
    <div className="film-capture min-h-svh bg-[#0c0c0b] text-white">
      <style>{`
        nextjs-portal,
        [data-next-badge-root],
        [data-nextjs-toast],
        [data-nextjs-dev-overlay] {
          display: none !important;
        }
      `}</style>
      {children}
    </div>
  );
}
