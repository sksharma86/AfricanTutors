import type { Metadata } from "next";

import { CtaSection } from "@/components/marketing/cta-section";
import { PageHeader } from "@/components/marketing/page-header";
import { SubjectsGrid } from "@/components/marketing/subjects-grid";

export const metadata: Metadata = {
  title: "Subjects",
  description: "Popular subjects supported by African Tutors, from core academics to test prep.",
};

export default function SubjectsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Subjects"
        title="One-on-one help across the subjects that matter most."
        description="Every session is matched to a qualified tutor for the subject and grade level your student needs. Here are the subjects families ask for most."
      />

      <SubjectsGrid
        title="Popular subjects"
        description="Tell us what your student needs when you get started, and we'll match a qualified tutor for that subject."
      />

      <CtaSection
        title="Not sure which subject to start with?"
        description="Get started and let us know what your student is working on \u2014 we'll take it from there."
      />
    </>
  );
}
