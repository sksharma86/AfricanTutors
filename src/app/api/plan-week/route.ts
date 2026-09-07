import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { getGuideApplicantInfo } from "@/lib/guide-applicant";
import { MAX_CHILDREN_PER_STUDY_HALL, uniqueStudentIds } from "@/lib/household-children.mjs";
import { PLAN_WEEK_DURATION_MINUTES } from "@/lib/plan-my-week.mjs";
import { schedulePlanWeek } from "@/lib/plan-week-service";
import { isStudyHallDuration } from "@/lib/pricing";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SAFE = /^[A-Za-z0-9 .,'!?()\-:$]+$/;
function safeError(message: string): string {
  return SAFE.test(message) && message.length < 160 ? message : "Something went wrong. Please try again.";
}

/**
 * Plan My Week orchestration. Each session is booked through createBookingCheckout
 * → book_session. This route does not compute funding, 365 usage, or availability.
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  if (user.role !== "student") {
    return NextResponse.json({ error: "Plan My Week is only available in the Parent Portal." }, { status: 403 });
  }
  const applicant = await getGuideApplicantInfo(user.id);
  if (applicant) {
    return NextResponse.json({ error: "Parent booking is not available on this account." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const studentIds = uniqueStudentIds([
    ...(Array.isArray((body as { studentIds?: unknown }).studentIds) ? ((body as { studentIds: unknown[] }).studentIds as string[]) : []),
    typeof (body as { studentId?: unknown }).studentId === "string" ? (body as { studentId: string }).studentId : "",
  ]);
  if (studentIds.length < 1) {
    return NextResponse.json({ error: "Choose who is joining Study Hall." }, { status: 400 });
  }
  if (studentIds.length > MAX_CHILDREN_PER_STUDY_HALL) {
    return NextResponse.json({ error: "Up to 3 children can join the same Study Hall." }, { status: 400 });
  }

  if ("duration" in body && (body as { duration?: unknown }).duration != null && !isStudyHallDuration((body as { duration?: unknown }).duration)) {
    return NextResponse.json({ error: "Study Hall sessions are 60 minutes." }, { status: 400 });
  }

  const sessions = Array.isArray((body as { sessions?: unknown }).sessions)
    ? ((body as { sessions: Array<{ startISO?: string; replaceBookingId?: string | null }> }).sessions)
    : [];
  if (sessions.length < 1) {
    return NextResponse.json({ error: "Choose at least one Study Hall time." }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Not available." }, { status: 503 });
  const { data: tz } = await supabase.rpc("resolve_account_timezone", { p_account: user.id });
  const timeZone = typeof tz === "string" && tz.trim() ? tz : "America/Chicago";
  const clientRequestId =
    typeof (body as { clientRequestId?: unknown }).clientRequestId === "string"
      ? (body as { clientRequestId: string }).clientRequestId
      : request.headers.get("x-plan-week-request-id");

  try {
    const result = await schedulePlanWeek({
      accountId: user.id,
      timeZone,
      studentIds,
      sessions,
      duration: PLAN_WEEK_DURATION_MINUTES,
      clientRequestId,
      baseUrl: request.nextUrl.origin,
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to plan this week.";
    const status = /not authenticated/i.test(message) ? 401 : 400;
    return NextResponse.json({ error: safeError(message) }, { status });
  }
}
