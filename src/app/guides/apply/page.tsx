import { redirect } from "next/navigation";

/** Clean alias for the Guide application signup flow. */
export default function GuidesApplyAliasPage() {
  redirect("/apply-to-tutor");
}
