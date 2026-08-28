"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { COMMON_TIMEZONES, formatDayHeading, formatTime, tzAbbreviation, wallTimeToUtcIso } from "@/lib/timezone";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function formatClock(t: string) {
  const [hh, mm] = t.slice(0, 5).split(":").map(Number);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return t;
  const h12 = hh % 12 || 12;
  const ap = hh >= 12 ? "PM" : "AM";
  return `${h12}:${String(mm).padStart(2, "0")} ${ap}`;
}

export interface AvailabilityBlock {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
}
export interface ExceptionRow {
  id: string;
  starts_at: string;
  ends_at: string;
  reason: string | null;
}

export function AvailabilityManager({
  tutorId,
  timezone: initialTz,
  blocks: initialBlocks,
  exceptions: initialExceptions,
}: {
  tutorId: string;
  timezone: string;
  blocks: AvailabilityBlock[];
  exceptions: ExceptionRow[];
}) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [tz, setTz] = useState(initialTz);
  const [blocks, setBlocks] = useState<AvailabilityBlock[]>(initialBlocks);
  const [exceptions, setExceptions] = useState<ExceptionRow[]>(initialExceptions);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [dow, setDow] = useState(1);
  const [start, setStart] = useState("17:00");
  const [end, setEnd] = useState("22:00");

  const [exDate, setExDate] = useState("");
  const [exStart, setExStart] = useState("09:00");
  const [exEnd, setExEnd] = useState("17:00");
  const [exReason, setExReason] = useState("");

  async function saveTimezone(next: string) {
    if (!supabase) return;
    setTz(next);
    const { error: e } = await supabase.from("tutor_profiles").update({ timezone: next }).eq("profile_id", tutorId);
    if (e) setError(e.message);
  }

  async function addBlock() {
    if (!supabase) return;
    setError(null);
    if (end <= start) {
      setError("End time must be after start time.");
      return;
    }
    setBusy(true);
    const { data, error: e } = await supabase
      .from("tutor_availability")
      .insert({ tutor_id: tutorId, day_of_week: dow, start_time: start, end_time: end })
      .select("id, day_of_week, start_time, end_time")
      .single();
    setBusy(false);
    if (e) {
      setError(e.message.includes("duplicate") ? "That block already exists." : e.message);
      return;
    }
    setBlocks((prev) => [...prev, data as AvailabilityBlock]);
  }

  async function removeBlock(id: string) {
    if (!supabase) return;
    const { error: e } = await supabase.from("tutor_availability").delete().eq("id", id);
    if (e) {
      setError(e.message);
      return;
    }
    setBlocks((prev) => prev.filter((b) => b.id !== id));
  }

  async function addException() {
    if (!supabase) return;
    setError(null);
    if (!exDate) {
      setError("Choose a date.");
      return;
    }
    if (exEnd <= exStart) {
      setError("Exception end must be after start.");
      return;
    }
    setBusy(true);
    const starts_at = wallTimeToUtcIso(exDate, exStart, tz);
    const ends_at = wallTimeToUtcIso(exDate, exEnd, tz);
    const { data, error: e } = await supabase
      .from("tutor_availability_exceptions")
      .insert({ tutor_id: tutorId, starts_at, ends_at, reason: exReason.trim() || null })
      .select("id, starts_at, ends_at, reason")
      .single();
    setBusy(false);
    if (e) {
      setError(e.message);
      return;
    }
    setExceptions((prev) => [...prev, data as ExceptionRow]);
    setExReason("");
  }

  async function removeException(id: string) {
    if (!supabase) return;
    const { error: e } = await supabase.from("tutor_availability_exceptions").delete().eq("id", id);
    if (e) {
      setError(e.message);
      return;
    }
    setExceptions((prev) => prev.filter((x) => x.id !== id));
  }

  const sortedBlocks = [...blocks].sort((a, b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time));

  return (
    <div className="space-y-8">
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      ) : null}

      <section className="rounded-2xl border border-ink-100 bg-white p-6">
        <h3 className="font-display text-lg font-semibold text-ink-900">Your timezone</h3>
        <p className="mt-1 text-sm text-ink-500">Availability is interpreted in this timezone.</p>
        <select
          value={tz}
          onChange={(e) => saveTimezone(e.target.value)}
          className="mt-3 w-full max-w-sm rounded-lg border border-ink-200 px-3 py-2 text-sm"
        >
          {COMMON_TIMEZONES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </section>

      <section className="rounded-2xl bg-white/80 px-5 py-5 ring-1 ring-ink-900/[0.05]">
        <h3 className="font-display text-lg font-semibold text-ink-900">Your weekly availability</h3>
        <p className="mt-1 text-sm text-ink-500">
          Recurring blocks parents can book for Study Hall (your local time). Changes save when you add or remove a time.
        </p>

        <ul className="mt-5 divide-y divide-ink-100">
          {DAYS.map((day, i) => {
            const dayBlocks = sortedBlocks.filter((b) => b.day_of_week === i);
            return (
              <li key={day} className="py-3">
                <p className="text-sm font-medium text-ink-900">{day}</p>
                {dayBlocks.length === 0 ? (
                  <p className="mt-0.5 text-sm text-ink-400">Unavailable</p>
                ) : (
                  <ul className="mt-1 space-y-1">
                    {dayBlocks.map((b) => (
                      <li key={b.id} className="flex items-center justify-between gap-3 text-sm text-ink-700">
                        <span>
                          {formatClock(b.start_time)} → {formatClock(b.end_time)}
                        </span>
                        <Button type="button" variant="destructive" size="sm" onClick={() => removeBlock(b.id)}>
                          Remove
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>

        <div className="mt-5 grid gap-3 sm:grid-cols-4">
          <select value={dow} onChange={(e) => setDow(Number(e.target.value))} className="rounded-lg border border-ink-200 px-3 py-2 text-sm">
            {DAYS.map((d, i) => (
              <option key={d} value={i}>
                {d}
              </option>
            ))}
          </select>
          <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className="rounded-lg border border-ink-200 px-3 py-2 text-sm" />
          <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="rounded-lg border border-ink-200 px-3 py-2 text-sm" />
          <Button onClick={addBlock} disabled={busy} variant="outline" size="sm">
            Add another time
          </Button>
        </div>
      </section>

      <section className="rounded-2xl bg-white/80 px-5 py-5 ring-1 ring-ink-900/[0.05]">
        <h3 className="font-display text-lg font-semibold text-ink-900">Time off / exceptions</h3>
        <p className="mt-1 text-sm text-ink-500">Mark yourself unavailable for a specific window, even inside your weekly hours.</p>

        {exceptions.length === 0 ? (
          <p className="mt-4 text-sm text-ink-400">No exceptions.</p>
        ) : (
          <ul className="mt-4 divide-y divide-ink-100">
            {[...exceptions]
              .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
              .map((x) => (
                <li key={x.id} className="flex items-center justify-between py-2.5">
                  <span className="text-sm text-ink-800">
                    {formatDayHeading(x.starts_at, tz)} · {formatTime(x.starts_at, tz)}–{formatTime(x.ends_at, tz)} (
                    {tzAbbreviation(x.starts_at, tz)}){x.reason ? ` · ${x.reason}` : ""}
                  </span>
                  <Button type="button" variant="destructive" size="sm" onClick={() => removeException(x.id)}>
                    Remove
                  </Button>
                </li>
              ))}
          </ul>
        )}

        <div className="mt-5 grid gap-3 sm:grid-cols-5">
          <input type="date" value={exDate} onChange={(e) => setExDate(e.target.value)} className="rounded-lg border border-ink-200 px-3 py-2 text-sm sm:col-span-2" />
          <input type="time" value={exStart} onChange={(e) => setExStart(e.target.value)} className="rounded-lg border border-ink-200 px-3 py-2 text-sm" />
          <input type="time" value={exEnd} onChange={(e) => setExEnd(e.target.value)} className="rounded-lg border border-ink-200 px-3 py-2 text-sm" />
          <Button onClick={addException} disabled={busy} variant="outline" size="sm">
            Add time off
          </Button>
          <input
            value={exReason}
            onChange={(e) => setExReason(e.target.value)}
            placeholder="Reason (optional)"
            className="rounded-lg border border-ink-200 px-3 py-2 text-sm sm:col-span-5"
          />
        </div>
      </section>
    </div>
  );
}
