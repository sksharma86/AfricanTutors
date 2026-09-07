import "server-only";

import { createBookingCheckout } from "@/lib/checkout-service";
import { MAX_CHILDREN_PER_STUDY_HALL, uniqueStudentIds } from "@/lib/household-children.mjs";
import {
  PLAN_WEEK_DURATION_MINUTES,
  normalizePlanWeekRequest,
  planWeekResultMessage,
  startAlreadyBooked,
} from "@/lib/plan-my-week.mjs";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type PlanWeekSessionResult = {
  localDate: string | null;
  startISO: string;
  replaceBookingId: string | null;
  status: "scheduled" | "already_scheduled" | "needs_payment" | "unavailable" | "error";
  message: string;
  bookingId?: string;
  checkoutUrl?: string;
  funding?: string;
};

export type PlanWeekScheduleResult = {
  results: PlanWeekSessionResult[];
};

type PlanSession = {
  startISO: string;
  localDate: string | null;
  replaceBookingId: string | null;
};

type ExistingRow = { id: string; scheduled_start: string | null; status: string };

const inflight = new Map<string, Promise<PlanWeekScheduleResult>>();
const recent = new Map<string, { at: number; result: PlanWeekScheduleResult }>();
const RECENT_MS = 2 * 60_000;

function recentKey(accountId: string, clientRequestId: string) {
  return `${accountId}:${clientRequestId}`;
}

async function loadExistingBookings(
  supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  now: Date,
): Promise<ExistingRow[]> {
  const from = new Date(now.getTime() - 2 * 86_400_000).toISOString();
  const to = new Date(now.getTime() + 21 * 86_400_000).toISOString();
  const { data } = await supabase
    .from("bookings")
    .select("id, scheduled_start, status")
    .in("status", ["pending", "confirmed"])
    .gte("scheduled_start", from)
    .lte("scheduled_start", to);
  return (data ?? []) as ExistingRow[];
}

async function cancelExisting(
  supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  bookingId: string,
): Promise<{ ok: boolean; message?: string }> {
  const { data, error } = await supabase.rpc("customer_cancel_booking", { p_booking: bookingId });
  if (error) return { ok: false, message: "We booked the new time but could not cancel the previous session." };
  const result = data as { status?: string };
  if (result?.status === "cancelled" || result?.status === "noop" || result?.status === "already_cancelled") {
    return { ok: true };
  }
  return { ok: false, message: "We booked the new time but could not cancel the previous session." };
}

async function scheduleOne(
  session: PlanSession,
  studentIds: string[],
  baseUrl: string,
  existing: ExistingRow[],
): Promise<PlanWeekSessionResult> {
  const match = startAlreadyBooked(existing, session.startISO);
  if (match && match.id !== session.replaceBookingId) {
    return {
      localDate: session.localDate,
      startISO: session.startISO,
      replaceBookingId: session.replaceBookingId,
      status: "already_scheduled",
      message: "Already on your schedule.",
      bookingId: match.id,
    };
  }

  try {
    const booked = await createBookingCheckout(
      {
        studentId: studentIds[0],
        studentIds,
        subjectId: null,
        otherSubject: null,
        note: null,
        duration: 60,
        startISO: session.startISO,
        isFreeTrial: false,
        replaceBookingId: session.replaceBookingId,
      },
      baseUrl,
    );

    const paymentPending = booked.status === "requires_payment" || (booked.stripeCentsDue ?? 0) > 0;

    if (session.replaceBookingId && booked.bookingId && !paymentPending) {
      const supabase = await createSupabaseServerClient();
      if (supabase) {
        const cancelled = await cancelExisting(supabase, session.replaceBookingId);
        if (!cancelled.ok) {
          return {
            localDate: session.localDate,
            startISO: session.startISO,
            replaceBookingId: session.replaceBookingId,
            status: "scheduled",
            message: cancelled.message ?? "Scheduled. Cancel the previous session from Study Halls if it is still listed.",
            bookingId: booked.bookingId,
            checkoutUrl: booked.checkoutUrl,
            funding: booked.fundingSource ?? booked.funding,
          };
        }
      }
    }

    if (paymentPending) {
      return {
        localDate: session.localDate,
        startISO: session.startISO,
        replaceBookingId: session.replaceBookingId,
        status: "needs_payment",
        message: session.replaceBookingId
          ? "Complete payment to confirm the new time. Your current session stays scheduled until then."
          : "Time reserved — complete payment to confirm.",
        bookingId: booked.bookingId,
        checkoutUrl: booked.checkoutUrl,
        funding: booked.fundingSource ?? booked.funding,
      };
    }

    return {
      localDate: session.localDate,
      startISO: session.startISO,
      replaceBookingId: session.replaceBookingId,
      status: "scheduled",
      message: "Scheduled",
      bookingId: booked.bookingId,
      funding: booked.fundingSource ?? booked.funding,
    };
  } catch (err) {
    const raw = err instanceof Error ? err.message : "Booking failed.";
    const message = planWeekResultMessage(raw);
    const unavailable = /no longer available|already passed|already scheduled|already has a Study Hall/i.test(message);
    return {
      localDate: session.localDate,
      startISO: session.startISO,
      replaceBookingId: session.replaceBookingId,
      status: unavailable ? "unavailable" : "error",
      message,
    };
  }
}

/**
 * Book each requested Study Hall through the existing checkout/book_session path.
 * Partial success is intentional: one unavailable slot does not roll back the week.
 */
export async function schedulePlanWeek(params: {
  accountId: string;
  timeZone: string;
  studentIds: string[];
  sessions: Array<{ startISO?: string; replaceBookingId?: string | null }>;
  duration?: number;
  clientRequestId?: string | null;
  baseUrl: string;
  now?: Date;
}): Promise<PlanWeekScheduleResult> {
  const studentIds = uniqueStudentIds(params.studentIds);
  if (studentIds.length < 1) {
    throw new Error("Choose who is joining Study Hall.");
  }
  if (studentIds.length > MAX_CHILDREN_PER_STUDY_HALL) {
    throw new Error("Up to 3 children can join the same Study Hall.");
  }

  const requestId = typeof params.clientRequestId === "string" ? params.clientRequestId.trim() : "";
  if (requestId) {
    const cached = recent.get(recentKey(params.accountId, requestId));
    if (cached && Date.now() - cached.at < RECENT_MS) {
      return cached.result;
    }
    const pending = inflight.get(recentKey(params.accountId, requestId));
    if (pending) return pending;
  }

  const work = (async () => {
    const supabase = await createSupabaseServerClient();
    if (!supabase) throw new Error("Not available.");
    const now = params.now ?? new Date();
    const existing = await loadExistingBookings(supabase, now);
    const normalized = normalizePlanWeekRequest(
      { duration: params.duration ?? PLAN_WEEK_DURATION_MINUTES, sessions: params.sessions },
      { timeZone: params.timeZone, nowMs: now.getTime(), existingBookings: existing },
    );
    if (!normalized.ok) {
      throw new Error(normalized.error ?? "Unable to plan this week.");
    }

    const results: PlanWeekSessionResult[] = (normalized.skipped ?? []).map((row) => ({
      localDate: row.localDate,
      startISO: row.startISO,
      replaceBookingId: row.replaceBookingId,
      status: (row.status as PlanWeekSessionResult["status"]) ?? "error",
      message: row.message ?? "Unable to schedule this time.",
      bookingId: "bookingId" in row ? row.bookingId : undefined,
    }));

    const liveExisting = [...existing];
    for (const session of normalized.sessions) {
      const result = await scheduleOne(session, studentIds, params.baseUrl, liveExisting);
      results.push(result);
      if (result.bookingId && (result.status === "scheduled" || result.status === "already_scheduled" || result.status === "needs_payment")) {
        liveExisting.push({
          id: result.bookingId,
          scheduled_start: result.startISO,
          status: "confirmed",
        });
      }
    }

    results.sort((a, b) => String(a.startISO).localeCompare(String(b.startISO)));
    return { results };
  })();

  if (requestId) {
    const key = recentKey(params.accountId, requestId);
    inflight.set(key, work);
    try {
      const result = await work;
      recent.set(key, { at: Date.now(), result });
      return result;
    } finally {
      inflight.delete(key);
    }
  }

  return work;
}
