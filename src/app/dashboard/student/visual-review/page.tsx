import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ParentHomeBoard } from "@/components/dashboard/parent-home-board";
import { ParentPage } from "@/components/dashboard/parent-page";
import { requireRole } from "@/lib/auth";
import { parentHomeVisualFixture } from "@/lib/parent-home-visual-fixture.mjs";

export const metadata: Metadata = { title: "Home visual review" };
export const dynamic = "force-dynamic";

/**
 * Isolated composition review. 404 unless PARENT_HOME_VISUAL_REVIEW=1.
 * Does not write to the database. Not linked from Parent navigation.
 */
export default async function ParentHomeVisualReviewPage() {
  if (process.env.PARENT_HOME_VISUAL_REVIEW !== "1") notFound();
  await requireRole("student", "/dashboard/student");
  const fixture = parentHomeVisualFixture();

  return (
    <ParentPage compose>
      <p className="sr-only">Visual review fixture. Not customer data.</p>
      <ParentHomeBoard {...fixture} />
    </ParentPage>
  );
}
