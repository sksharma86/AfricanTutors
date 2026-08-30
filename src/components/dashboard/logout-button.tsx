"use client";

import { useState } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export function LogoutButton({
  className,
  quiet = false,
}: {
  className?: string;
  /** Parent Portal: text action, not a white pill. Guide / Management keep the default. */
  quiet?: boolean;
}) {
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch {
        /* still leave the session UI */
      }
    }
    // Full navigation so auth cookies are dropped before the next document load.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- session cookie must be cleared on a new document
    window.location.assign("/");
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      className={cn(
        "inline-flex min-h-11 items-center px-3.5 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none",
        quiet
          ? "rounded-[12px] border-transparent bg-transparent text-[#6b655c] hover:bg-[#ebe4d6] hover:text-[#1c1915] focus-visible:outline-[#c9a227] disabled:bg-transparent disabled:text-[#b0aaa0]"
          : "rounded-full border border-ink-200 bg-white text-ink-700 hover:border-ink-300 hover:bg-ink-50 hover:text-ink-900 focus-visible:outline-ink-900 disabled:border-ink-200 disabled:bg-ink-100 disabled:text-ink-400",
        className,
      )}
    >
      {loading ? "Logging out..." : "Log out"}
    </button>
  );
}
