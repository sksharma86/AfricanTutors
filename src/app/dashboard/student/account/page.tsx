import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ParentPage } from "@/components/dashboard/parent-page";
import { ParentPhoneForm } from "@/components/dashboard/parent-phone-form";
import { requireRole } from "@/lib/auth";
import { accountFreeTrialUsed } from "@/lib/free-trial.mjs";
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
  const freeTrialAvailable = !accountFreeTrialUsed(data.bookings);

  return (
    <ParentPage>
      <h1 id="account" className="font-display text-2xl font-semibold text-ink-900">Account</h1>
      <p className="mt-1 text-sm text-ink-500">Household details Study Hall (at home) uses to support your child.</p>

      <dl className="mt-8 grid gap-4 text-sm">
        <div>
          <dt className="text-[11px] font-medium tracking-wide text-ink-400 uppercase">Parent name</dt>
          <dd className="mt-1 text-ink-800">{data.parentName ?? user.displayName ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-medium tracking-wide text-ink-400 uppercase">Email</dt>
          <dd className="mt-1 text-ink-800">{user.email ?? "—"}</dd>
        </div>
      </dl>

      <section className="mt-8 border-t border-ink-100 pt-6">
        <ParentPhoneForm initialPhone={data.parentPhone} />
      </section>

      <section className="mt-8 border-t border-ink-100 pt-6">
        <h2 className="text-sm font-semibold tracking-wide text-ink-400 uppercase">Children</h2>
        {data.students.length === 0 ? (
          <p className="mt-2 text-sm text-ink-500">Add a child when you book your first Study Hall.</p>
        ) : (
          <ul className="mt-3 divide-y divide-ink-100">
            {data.students.map((s) => (
              <li key={s.id} className="py-2.5">
                <p className="text-sm font-medium text-ink-900">{s.full_name}</p>
                {s.grade_level ? <p className="text-sm text-ink-500">Grade {s.grade_level}</p> : null}
              </li>
            ))}
          </ul>
        )}
        {freeTrialAvailable ? (
          <p className="mt-4 text-sm text-ink-500">Your first Study Hall is still available — no credit card required.</p>
        ) : (
          <p className="mt-4 text-sm text-ink-500">One account can book for multiple children.</p>
        )}
      </section>
    </ParentPage>
  );
}
