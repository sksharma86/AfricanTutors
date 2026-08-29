/**
 * Canonical Study Hall scheduling grid: customer-facing start times are :00 or :30.
 * Slot generation snaps FORWARD to the next half-hour without expanding availability.
 */

export const HALF_HOUR_STEP_MINUTES = 30;

/** Clock strings `HH:MM` from 00:00 through 23:30 inclusive. */
export function halfHourClockOptions() {
  const out = [];
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 30]) {
      out.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return out;
}

export function parseClock(value) {
  const raw = String(value ?? "").trim();
  const match = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3] ?? 0);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59) return null;
  return { hour, minute, second };
}

export function isHalfHourClock(value) {
  const t = parseClock(value);
  return Boolean(t && (t.minute === 0 || t.minute === 30) && t.second === 0);
}

/** Next :00/:30 at or after the clock. Returns null if that would roll to the next day. */
export function ceilHalfHourClock(value) {
  const t = parseClock(value);
  if (!t) return null;
  if (t.minute === 0 && t.second === 0) return clockString(t.hour, 0);
  if (t.minute < 30) return clockString(t.hour, 30);
  if (t.minute === 30 && t.second === 0) return clockString(t.hour, 30);
  if (t.hour >= 23) return null;
  return clockString(t.hour + 1, 0);
}

export function floorHalfHourClock(value) {
  const t = parseClock(value);
  if (!t) return null;
  if (t.minute === 0 && t.second === 0) return clockString(t.hour, 0);
  if (t.minute < 30) return clockString(t.hour, 0);
  return clockString(t.hour, 30);
}

function clockString(hour, minute) {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/**
 * Candidate starts on the half-hour grid that lie entirely inside [start, end].
 * Does not expand the window. Duration must fit.
 */
export function halfHourStartsInsideWindow(startClock, endClock, durationMinutes, stepMinutes = HALF_HOUR_STEP_MINUTES) {
  const start = parseClock(startClock);
  const end = parseClock(endClock);
  const duration = Number(durationMinutes);
  const step = Number(stepMinutes);
  if (!start || !end || !(duration > 0) || !(step > 0) || step % HALF_HOUR_STEP_MINUTES !== 0) return [];
  const startMin = start.hour * 60 + start.minute + start.second / 60;
  const endMin = end.hour * 60 + end.minute + end.second / 60;
  if (!(endMin > startMin)) return [];

  const first = Math.ceil(startMin / HALF_HOUR_STEP_MINUTES) * HALF_HOUR_STEP_MINUTES;
  const last = Math.floor((endMin - duration) / HALF_HOUR_STEP_MINUTES) * HALF_HOUR_STEP_MINUTES;
  if (last < first) return [];

  const out = [];
  for (let m = first; m <= last; m += step) {
    if (m < startMin || m + duration > endMin + 1e-9) continue;
    if (m > 23 * 60 + 30) break;
    out.push(clockString(Math.floor(m / 60), m % 60));
  }
  return out;
}

export function localPartsInTz(iso, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(iso));
  const get = (type) => parts.find((p) => p.type === type)?.value;
  let hour = Number(get("hour"));
  if (hour === 24) hour = 0;
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour,
    minute: Number(get("minute")),
    second: Number(get("second")),
  };
}

export function isHalfHourInstant(iso, timeZone) {
  if (!iso || !timeZone) return false;
  try {
    const p = localPartsInTz(iso, timeZone);
    return (p.minute === 0 || p.minute === 30) && p.second === 0;
  } catch {
    return false;
  }
}

export const HALF_HOUR_START_ERROR =
  "Study Hall start times must be on the half-hour (:00 or :30) in the local booking timezone.";

export function assertHalfHourStart(iso, timeZones) {
  if (!iso) return;
  for (const tz of timeZones ?? []) {
    if (tz && !isHalfHourInstant(iso, tz)) {
      throw new Error(HALF_HOUR_START_ERROR);
    }
  }
}
