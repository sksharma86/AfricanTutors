import type { Metadata } from "next";
import Link from "next/link";

import { Container } from "@/components/ui/container";

export const metadata: Metadata = {
  title: "Dashboard",
};

const dashboards = [
  { href: "/dashboard/student", label: "Student Dashboard" },
  { href: "/dashboard/tutor", label: "Tutor Dashboard" },
  { href: "/dashboard/admin", label: "Admin Dashboard" },
];

export default function DashboardIndexPage() {
  return (
    <Container className="py-16">
      <h1 className="font-display text-2xl font-semibold text-ink-900">Dashboards</h1>
      <p className="mt-2 max-w-lg text-sm text-ink-500">
        Once you&apos;re logged in, you&apos;ll be sent straight to the right dashboard for your
        role. For now, here are placeholders for each one.
      </p>
      <ul className="mt-6 space-y-3">
        {dashboards.map((dashboard) => (
          <li key={dashboard.href}>
            <Link
              href={dashboard.href}
              className="inline-block rounded-lg border border-ink-200 px-4 py-2.5 text-sm font-medium text-ink-800 hover:border-ink-300 hover:bg-ink-50"
            >
              {dashboard.label}
            </Link>
          </li>
        ))}
      </ul>
    </Container>
  );
}
