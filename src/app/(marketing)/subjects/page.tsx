import type { Metadata } from "next";
import { redirect } from "next/navigation";

/**
 * Legacy tutoring catalog route. Study Hall is a dedicated academic hour —
 * not subject-by-subject tutoring. Redirect keeps old links from 404ing.
 */
export const metadata: Metadata = {
  title: "What Kids Work On",
  robots: { index: false, follow: false },
};

export default function SubjectsPage() {
  redirect("/the-study-hall-hour");
}
