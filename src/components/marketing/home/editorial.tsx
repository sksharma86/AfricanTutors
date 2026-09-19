import type { ReactNode } from "react";

/**
 * Renders an approved statement verbatim, setting one word in the editorial
 * italic so the headline reads as a visual object without changing the copy.
 */
export function EditorialLine({ text, accent }: { text: string; accent?: string }): ReactNode {
  if (!accent) return text;
  const at = text.indexOf(accent);
  if (at < 0) return text;
  return (
    <>
      {text.slice(0, at)}
      <em>{accent}</em>
      {text.slice(at + accent.length)}
    </>
  );
}
