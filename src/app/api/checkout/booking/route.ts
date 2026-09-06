import { NextResponse, type NextRequest } from "next/server";

import { createBookingCheckout } from "@/lib/checkout-service";
import { MAX_CHILDREN_PER_STUDY_HALL, uniqueStudentIds } from "@/lib/household-children.mjs";
import { isStudyHallDuration, type StudyHallDuration } from "@/lib/pricing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SAFE = /^[A-Za-z0-9 .,'!?()\-:$]+$/;
function safeError(message: string): string {
  return SAFE.test(message) && message.length < 160 ? message : "Something went wrong. Please try again.";
}

function resolveStudentIds(body: Record<string, unknown>): string[] {
  const fromArray = Array.isArray(body.studentIds) ? body.studentIds : [];
  const single = typeof body.studentId === "string" ? [body.studentId] : [];
  return uniqueStudentIds([...fromArray, ...single]);
}

/**
 * Start checkout for a booking. Server-authoritative: `book_session` prices the
 * session and decides funding; the client cannot set an amount. Returns either a
 * Stripe Checkout URL (payment due) or a confirmed/request result (no payment).
 *
 * New customer Study Halls are exactly 60 minutes. Duration is rejected when
 * supplied as anything else. Price and funding are decided by book_session.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const studentIds = resolveStudentIds(body as Record<string, unknown>);
  if (studentIds.length < 1) {
    return NextResponse.json({ error: "Choose who is joining Study Hall." }, { status: 400 });
  }
  if (studentIds.length > MAX_CHILDREN_PER_STUDY_HALL) {
    return NextResponse.json(
      { error: "Up to 3 children can join the same Study Hall." },
      { status: 400 },
    );
  }
  if ("duration" in (body as object) && (body as { duration?: unknown }).duration != null && !isStudyHallDuration((body as { duration?: unknown }).duration)) {
    return NextResponse.json({ error: "Study Hall sessions are 60 minutes." }, { status: 400 });
  }
  const duration: StudyHallDuration = 60;
  const isFreeTrial = Boolean(body.isFreeTrial);
  const subjectId = typeof body.subjectId === "string" ? body.subjectId : null;

  try {
    const result = await createBookingCheckout(
      {
        studentId: studentIds[0],
        studentIds,
        subjectId,
        otherSubject: typeof body.otherSubject === "string" ? body.otherSubject : null,
        note: typeof body.note === "string" ? body.note : null,
        duration,
        startISO: typeof body.startISO === "string" ? body.startISO : null,
        isFreeTrial,
      },
      request.nextUrl.origin,
    );
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Booking failed.";
    const status = /not authenticated/i.test(message) ? 401 : 400;
    return NextResponse.json({ error: safeError(message) }, { status });
  }
}
