"use client";

import { useEffect } from "react";

const THRESHOLD_PX = 16;

/**
 * Homepage-only: mark the public header after a short scroll so CSS can add
 * a restrained reading surface. Stickiness itself is CSS (position: fixed).
 */
export function HomeHeaderScroll() {
  useEffect(() => {
    const header = document.querySelector("body:has(.sh-home) header");
    if (!(header instanceof HTMLElement)) return;

    const sync = () => {
      header.toggleAttribute("data-scrolled", window.scrollY > THRESHOLD_PX);
    };

    sync();
    window.addEventListener("scroll", sync, { passive: true });
    return () => window.removeEventListener("scroll", sync);
  }, []);

  return null;
}
