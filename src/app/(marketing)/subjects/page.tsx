import type { Metadata } from "next";

import { CtaSection } from "@/components/marketing/cta-section";
import { PageHeader } from "@/components/marketing/page-header";
import { SubjectsSection } from "@/components/marketing/subjects-section";
import { getPublicSubjects } from "@/lib/marketing";

export const metadata: Metadata = {
  title: "What Kids Work On",
  description:
    "In Study Hall, kids bring their own homework across any subject — Math, Science, English & Writing, and more. A Guide keeps them focused and accountable; Study Hall is supervision, not subject-by-subject tutoring.",
  alternates: { canonical: "/subjects" },
};

export default async function SubjectsPage() {
  const subjects = await getPublicSubjects();

  return (
    <>
      <PageHeader
        eyebrow="What kids work on"
        title="Any subject, any homework."
        description="Kids bring their own assignments and a Guide keeps them focused across whatever they're working on. Study Hall is homework supervision and accountability — not subject-by-subject tutoring."
      />

      <SubjectsSection categories={subjects} withHeader={false} />

      <CtaSection
        title="Not sure where to start?"
        description="Just get started — your child brings their homework and the Guide takes it from there."
      />
    </>
  );
}
