import type { Metadata } from "next";

import { CtaSection } from "@/components/marketing/cta-section";
import { PageHeader } from "@/components/marketing/page-header";
import { SubjectsSection } from "@/components/marketing/subjects-section";
import { getPublicSubjects } from "@/lib/marketing";

export const metadata: Metadata = {
  title: "Subjects",
  description:
    "Subjects supported by African Tutors — Math, Science, English & Writing, Test Prep, and select college courses. Every session is matched to a qualified, approved tutor.",
  alternates: { canonical: "/subjects" },
};

export default async function SubjectsPage() {
  const subjects = await getPublicSubjects();

  return (
    <>
      <PageHeader
        eyebrow="Subjects"
        title="One-on-one help across the subjects that matter most."
        description="Every session is matched to a qualified tutor for the subject and level you need. Here's what we currently support."
      />

      <SubjectsSection categories={subjects} withHeader={false} />

      <CtaSection
        title="Not sure where to start?"
        description="Get started and tell us what you're working on — we'll match a qualified tutor for that subject."
      />
    </>
  );
}
