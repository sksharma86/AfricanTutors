/**
 * PR7B — classify Study Hall 365 parent-email transitions from the
 * authoritative membership snapshot returned by upsert (previous vs current).
 *
 * Do not call this from a raw Stripe event type. A webhook is only a hint
 * that sync should run; the email is derived after the DB write.
 */

import { NOTIFICATION_EVENTS } from "./events.mjs";
import { isSubscriptionEntitled } from "../study-hall-365/entitlement.mjs";

/**
 * @typedef {{
 *   status?: string | null,
 *   cancel_at_period_end?: boolean | null,
 *   current_period_start?: string | null,
 *   current_period_end?: string | null,
 *   canceled_at?: string | null,
 *   ended_at?: string | null,
 * }} StudyHall365Snapshot
 */

/**
 * @param {unknown} value
 * @returns {string | null}
 */
export function isoKeyPart(value) {
  if (value == null || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(d.getTime())) return null;
  return d.toISOString();
}

export function studyHall365StartedKey(subscriptionId) {
  return `365-started:${subscriptionId}`;
}

export function studyHall365RenewedKey(subscriptionId, periodEnd) {
  const end = isoKeyPart(periodEnd);
  if (!subscriptionId || !end) return null;
  return `365-renewed:${subscriptionId}:${end}`;
}

export function studyHall365CancelScheduledKey(subscriptionId, canceledAt) {
  const when = isoKeyPart(canceledAt);
  if (!subscriptionId || !when) return null;
  return `365-cancel-scheduled:${subscriptionId}:${when}`;
}

export function studyHall365ResumedKey(subscriptionId, previousCanceledAt) {
  const when = isoKeyPart(previousCanceledAt);
  if (!subscriptionId || !when) return null;
  return `365-resumed:${subscriptionId}:${when}`;
}

export function studyHall365EndedKey(subscriptionId) {
  return `365-ended:${subscriptionId}`;
}

/**
 * A prior row counts as an established membership (not a failed first invoice).
 * @param {StudyHall365Snapshot | null | undefined} snapshot
 */
export function wasEstablishedMembership(snapshot) {
  if (!snapshot) return false;
  const status = snapshot.status;
  if (!status || status === "incomplete" || status === "incomplete_expired" || status === "trialing") {
    return false;
  }
  return true;
}

/**
 * @param {StudyHall365Snapshot | null | undefined} snapshot
 * @param {Date | string | number} [now]
 */
export function snapshotEntitled(snapshot, now) {
  if (!snapshot) return false;
  return isSubscriptionEntitled(snapshot.status, {
    cancelAtPeriodEnd: Boolean(snapshot.cancel_at_period_end),
    periodEnd: snapshot.current_period_end,
    endedAt: snapshot.ended_at,
    now,
  });
}

function periodEndMs(snapshot) {
  const iso = isoKeyPart(snapshot?.current_period_end);
  if (!iso) return null;
  return Date.parse(iso);
}

function asBool(value) {
  return value === true || value === "true";
}

/**
 * @param {{
 *   applyStatus?: string | null,
 *   stripeSubscriptionId?: string | null,
 *   previous?: StudyHall365Snapshot | null,
 *   current?: StudyHall365Snapshot | null,
 *   now?: Date | string | number,
 * }} input
 * @returns {{ type: string, key: string }[]}
 */
export function classifyStudyHall365Transitions(input = {}) {
  const subId = typeof input.stripeSubscriptionId === "string" ? input.stripeSubscriptionId : "";
  const current = input.current;
  if (!subId || !current) return [];
  if (input.applyStatus === "skipped_stale") return [];

  const previous = input.previous ?? null;
  const now = input.now;
  const events = [];

  const currentlyEntitled = snapshotEntitled(current, now);
  const previouslyEstablished = wasEstablishedMembership(previous);

  if (currentlyEntitled && !previouslyEstablished) {
    events.push({
      type: NOTIFICATION_EVENTS.STUDY_HALL_365_STARTED,
      key: studyHall365StartedKey(subId),
    });
  }

  const prevEnd = periodEndMs(previous);
  const curEnd = periodEndMs(current);
  const periodAdvanced =
    previouslyEstablished && prevEnd != null && curEnd != null && curEnd > prevEnd;
  const startedNow = events.some((e) => e.type === NOTIFICATION_EVENTS.STUDY_HALL_365_STARTED);
  if (currentlyEntitled && periodAdvanced && !startedNow) {
    const key = studyHall365RenewedKey(subId, current.current_period_end);
    if (key) {
      events.push({
        type: NOTIFICATION_EVENTS.STUDY_HALL_365_RENEWED,
        key,
      });
    }
  }

  const prevCancel = previous ? asBool(previous.cancel_at_period_end) : null;
  const curCancel = asBool(current.cancel_at_period_end);
  const currentEnded = Boolean(isoKeyPart(current.ended_at));
  const previousEnded = Boolean(isoKeyPart(previous?.ended_at));

  if (previous && prevCancel === false && curCancel === true && !currentEnded) {
    const key = studyHall365CancelScheduledKey(subId, current.canceled_at);
    if (key) {
      events.push({
        type: NOTIFICATION_EVENTS.STUDY_HALL_365_CANCELLATION_SCHEDULED,
        key,
      });
    }
  }

  if (previous && prevCancel === true && curCancel === false && !currentEnded && currentlyEntitled) {
    const key = studyHall365ResumedKey(subId, previous.canceled_at);
    if (key) {
      events.push({
        type: NOTIFICATION_EVENTS.STUDY_HALL_365_RESUMED,
        key,
      });
    }
  }

  if (previous && previouslyEstablished && !previousEnded && currentEnded) {
    events.push({
      type: NOTIFICATION_EVENTS.STUDY_HALL_365_ENDED,
      key: studyHall365EndedKey(subId),
    });
  }

  return events;
}

/**
 * @param {unknown} upsert
 * @returns {{
 *   applyStatus: string,
 *   previous: StudyHall365Snapshot | null,
 *   current: StudyHall365Snapshot | null,
 *   accountId: string | null,
 * } | null}
 */
export function parseUpsertLifecycleSnapshot(upsert) {
  if (!upsert || typeof upsert !== "object") return null;
  const row = upsert;
  const applyStatus = typeof row.status === "string" ? row.status : "";
  return {
    applyStatus,
    previous: row.previous && typeof row.previous === "object" ? row.previous : null,
    current: row.current && typeof row.current === "object" ? row.current : null,
    accountId: typeof row.account_id === "string" ? row.account_id : null,
  };
}
