import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ParentCommunicationSafety } from "@/components/dashboard/parent-communication-safety";
import { ParentPage } from "@/components/dashboard/parent-page";
import { ParentPhoneForm } from "@/components/dashboard/parent-phone-form";
import { ParentSurface } from "@/components/dashboard/parent-surface";
import { requireRole } from "@/lib/auth";
import { getGuideApplicantInfo } from "@/lib/guide-applicant";
import { loadParentWorkspace } from "@/lib/parent-portal-data";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Account" };
export const dynamic = "force-dynamic";

export default async function ParentAccountPage() {
  const user = await requireRole("student", "/dashboard/student/account");
  const applicant = await getGuideApplicantInfo(user.id);
  if (applicant) redirect("/dashboard/applicant");
  const supabase = await createSupabaseServerClient();
  const data = await loadParentWorkspace(supabase!, user.id);

  return (
    <ParentPage>
      <h1 id="account" className="font-display text-3xl font-semibold tracking-[-0.035em] text-[var(--pp-ink)]">
        Account
      </h1>

      <ParentSurface className="mt-6">
        <p className="text-[11px] font-semibold tracking-[0.14em] text-[var(--pp-muted)] uppercase">Parent information</p>
        <dl className="mt-3 grid gap-4 text-sm">
          <div>
            <dt className="text-[var(--pp-muted)]">Parent name</dt>
            <dd className="mt-0.5 font-medium text-[var(--pp-ink)]">{data.parentName ?? user.displayName ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-[var(--pp-muted)]">Email</dt>
            <dd className="mt-0.5 font-medium text-[var(--pp-ink)]">{user.email ?? "—"}</dd>
          </div>
        </dl>
      </ParentSurface>

      <section className="mt-5">
        <ParentPhoneForm initialPhone={data.parentPhone} />
      </section>

      <ParentSurface className="mt-5">
        <p className="text-[11px] font-semibold tracking-[0.14em] text-[var(--pp-muted)] uppercase">Children</p>
        {data.students.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--pp-muted)]">Add a child when you book your first Study Hall.</p>
        ) : (
          <ul className="mt-3 divide-y divide-[#1c1915]/[0.06]">
            {data.students.map((s) => (
              <li key={s.id} className="py-2.5 first:pt-0 last:pb-0">
                <p className="text-sm font-medium text-[var(--pp-ink)]">{s.full_name}</p>
                {s.grade_level ? <p className="text-sm text-[var(--pp-muted)]">Grade {s.grade_level}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </ParentSurface>

      <section className="mt-5">
        <ParentCommunicationSafety />
      </section>
    </ParentPage>
  );
}
