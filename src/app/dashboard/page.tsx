import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { DASHBOARD_PATH_BY_ROLE } from "@/lib/roles";

export default async function DashboardIndexPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?redirectTo=/dashboard");
  }

  redirect(DASHBOARD_PATH_BY_ROLE[user.role]);
}
