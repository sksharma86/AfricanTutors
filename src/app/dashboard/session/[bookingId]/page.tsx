import type { Metadata } from "next";
import Link from "next/link";

import { SessionRoom } from "@/components/session/session-room";
import { Container } from "@/components/ui/container";
import { requireUser } from "@/lib/auth";
import { getSessionInfo, type SessionInfo } from "@/lib/session-service";

export const metadata: Metadata = { title: "Tutoring Session" };
export const dynamic = "force-dynamic";

export default async function SessionPage({ params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await params;
  await requireUser(`/dashboard/session/${bookingId}`);

  let info: SessionInfo;
  try {
    info = await getSessionInfo(bookingId);
  } catch {
    info = { authorized: false, reason: "error" };
  }

  const backHref = info.role === "tutor" ? "/dashboard/tutor" : info.role === "admin" ? "/dashboard/admin" : "/dashboard/student";

  return (
    <div className="min-h-full bg-ink-900 py-8">
      <Container className="max-w-5xl">
        <Link href={backHref} className="text-sm font-medium text-gold-300 hover:text-gold-200">
          ← Back to dashboard
        </Link>
        <div className="mt-4">
          {info.authorized ? (
            <SessionRoom bookingId={bookingId} info={info} />
          ) : (
            <div className="rounded-2xl border border-ink-700 bg-ink-800 p-8 text-center">
              <h1 className="font-display text-2xl font-semibold text-white">Session unavailable</h1>
              <p className="mt-2 text-sm text-ink-300">
                {info.reason === "not_found"
                  ? "We couldn't find that session."
                  : "You don't have access to this tutoring session."}
              </p>
            </div>
          )}
        </div>
      </Container>
    </div>
  );
}
