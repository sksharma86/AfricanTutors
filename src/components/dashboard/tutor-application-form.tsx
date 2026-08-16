"use client";

import { useState, type FormEvent } from "react";

import { submitTutorApplication } from "@/app/dashboard/tutor/actions";
import { Button } from "@/components/ui/button";

export interface TutorSubjectOption {
  id: string;
  name: string;
  category: string | null;
}

export function TutorApplicationForm({
  subjects,
  initialValues,
  selectedSubjectIds,
}: {
  subjects: TutorSubjectOption[];
  initialValues: {
    headline: string;
    bio: string;
    education: string;
    yearsExperience: number | null;
    applicationNotes: string;
  };
  selectedSubjectIds: string[];
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(selectedSubjectIds));
  const [status, setStatus] = useState<"idle" | "submitting" | "error" | "success">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function toggleSubject(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    setErrorMessage(null);

    const formData = new FormData(event.currentTarget);
    const yearsExperienceRaw = String(formData.get("yearsExperience") ?? "").trim();

    const result = await submitTutorApplication({
      headline: String(formData.get("headline") ?? ""),
      bio: String(formData.get("bio") ?? ""),
      education: String(formData.get("education") ?? ""),
      yearsExperience: yearsExperienceRaw ? Number(yearsExperienceRaw) : null,
      applicationNotes: String(formData.get("applicationNotes") ?? ""),
      subjectIds: Array.from(selected),
    });

    if (!result.ok) {
      setStatus("error");
      setErrorMessage(result.error);
      return;
    }

    setStatus("success");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl border border-ink-100 bg-white p-6">
      <div>
        <label htmlFor="headline" className="block text-sm font-medium text-ink-800">
          Headline
        </label>
        <input
          id="headline"
          name="headline"
          type="text"
          defaultValue={initialValues.headline}
          placeholder="e.g. Experienced high school maths tutor"
          className="mt-1.5 w-full rounded-lg border border-ink-200 px-3.5 py-2.5 text-sm text-ink-900 outline-none placeholder:text-ink-300 focus:border-ink-400"
        />
      </div>

      <div>
        <label htmlFor="bio" className="block text-sm font-medium text-ink-800">
          Short bio
        </label>
        <textarea
          id="bio"
          name="bio"
          rows={4}
          defaultValue={initialValues.bio}
          placeholder="Tell students a bit about your teaching style and background."
          className="mt-1.5 w-full rounded-lg border border-ink-200 px-3.5 py-2.5 text-sm text-ink-900 outline-none placeholder:text-ink-300 focus:border-ink-400"
        />
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="education" className="block text-sm font-medium text-ink-800">
            Education
          </label>
          <input
            id="education"
            name="education"
            type="text"
            defaultValue={initialValues.education}
            placeholder="e.g. B.Sc. Mathematics, University of Lagos"
            className="mt-1.5 w-full rounded-lg border border-ink-200 px-3.5 py-2.5 text-sm text-ink-900 outline-none placeholder:text-ink-300 focus:border-ink-400"
          />
        </div>
        <div>
          <label htmlFor="yearsExperience" className="block text-sm font-medium text-ink-800">
            Years of teaching experience
          </label>
          <input
            id="yearsExperience"
            name="yearsExperience"
            type="number"
            min={0}
            max={80}
            defaultValue={initialValues.yearsExperience ?? undefined}
            className="mt-1.5 w-full rounded-lg border border-ink-200 px-3.5 py-2.5 text-sm text-ink-900 outline-none focus:border-ink-400"
          />
        </div>
      </div>

      <fieldset>
        <legend className="block text-sm font-medium text-ink-800">Subjects you&apos;d like to teach</legend>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {subjects.map((subject) => (
            <label
              key={subject.id}
              className="flex items-center gap-2 rounded-lg border border-ink-200 px-3 py-2 text-sm text-ink-700 hover:border-ink-300"
            >
              <input
                type="checkbox"
                checked={selected.has(subject.id)}
                onChange={() => toggleSubject(subject.id)}
                className="h-4 w-4 rounded border-ink-300"
              />
              {subject.name}
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="applicationNotes" className="block text-sm font-medium text-ink-800">
          Anything else you&apos;d like our team to know?
        </label>
        <textarea
          id="applicationNotes"
          name="applicationNotes"
          rows={3}
          defaultValue={initialValues.applicationNotes}
          placeholder="Optional"
          className="mt-1.5 w-full rounded-lg border border-ink-200 px-3.5 py-2.5 text-sm text-ink-900 outline-none placeholder:text-ink-300 focus:border-ink-400"
        />
      </div>

      {status === "error" && errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
      {status === "success" ? (
        <p className="text-sm text-brand-700">Saved. Our team will review your application.</p>
      ) : null}

      <Button type="submit" disabled={status === "submitting"}>
        {status === "submitting" ? "Saving..." : "Save Application"}
      </Button>
    </form>
  );
}
