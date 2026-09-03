"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  INCIDENT_TYPES,
  filterIncidents,
  incidentGuideOptions,
  summarizeIncidents,
} from "@/lib/management-incidents.mjs";
import { browserTimezone, formatDayHeading, formatTime } from "@/lib/timezone";
import { cn } from "@/lib/utils";

export type IncidentRow = {
  id: string;
  type: string;
  typeLabel: string;
  status: "open" | "resolved";
  severity: "critical" | "high" | "medium";
  resolutionLabel: string;
  occurredAt: string | null;
  opened_at: string | null;
  childName: string;
  parentName: string | null;
  guideName: string | null;
  guideId: string | null;
  missedGuideId: string | null;
  scheduledStart: string | null;
  description: string;
  href: string;
};

const SEVERITY_TONE: Record<string, string> = {
  critical: "text-[var(--mg-critical)]",
  high: "text-[var(--mg-attention)]",
  medium: "text-[var(--mg-muted)]",
};

function severityLabel(value: string) {
  if (value === "critical") return "Critical";
  if (value === "high") return "High";
  return "Medium";
}

export function ManagementIncidentHistory({
  incidents,
  nowMs: nowMsProp,
}: {
  incidents: IncidentRow[];
  nowMs?: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const tz = useMemo(() => browserTimezone(), []);
  const [queryDraft, setQueryDraft] = useState(params.get("q") ?? "");
  void nowMsProp;

  const filters = {
    status: params.get("status") ?? "all",
    type: params.get("type") ?? "all",
    severity: params.get("severity") ?? "all",
    dateFrom: params.get("from") ?? "",
    dateTo: params.get("to") ?? "",
    guideId: params.get("guide") || "all",
    query: params.get("q") ?? "",
    tz,
  };

  const rows = useMemo(() => filterIncidents(incidents as never, filters), [incidents, filters.status, filters.type, filters.severity, filters.dateFrom, filters.dateTo, filters.guideId, filters.query, tz]);
  const summary = summarizeIncidents(rows as never);
  const guides = incidentGuideOptions(incidents as never);

  function apply(next: Record<string, string>) {
    const sp = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(next)) {
      if (!value || value === "all") sp.delete(key);
      else sp.set(key, value);
    }
    router.replace(`${pathname}${sp.toString() ? `?${sp}` : ""}`);
  }

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    apply({ q: queryDraft.trim() });
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryStat label="Incidents in view" value={summary.total} />
        <SummaryStat label="Resolved automatically" value={summary.resolvedAutomatically} />
        <SummaryStat label="Manager intervention" value={summary.managerIntervention} />
        <SummaryStat label="Customer-impacting" value={summary.customerImpacting} />
      </div>

      <form onSubmit={submitSearch} className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center">
        <input
          value={queryDraft}
          onChange={(e) => setQueryDraft(e.target.value)}
          placeholder="Child, parent, or Guide"
          className="min-h-11 min-w-0 flex-1 rounded-[10px] border border-[#1c1915]/12 bg-[var(--mg-card)] px-3 text-sm outline-none"
        />
        <select
          value={filters.status}
          onChange={(e) => apply({ status: e.target.value })}
          className="min-h-11 rounded-[10px] border border-[#1c1915]/12 bg-[var(--mg-card)] px-3 text-sm"
          aria-label="Status"
        >
          <option value="all">All statuses</option>
          <option value="open">Open</option>
          <option value="resolved">Resolved</option>
        </select>
        <select
          value={filters.type}
          onChange={(e) => apply({ type: e.target.value })}
          className="min-h-11 rounded-[10px] border border-[#1c1915]/12 bg-[var(--mg-card)] px-3 text-sm"
          aria-label="Incident type"
        >
          <option value="all">All types</option>
          {Object.entries(INCIDENT_TYPES).map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
        <select
          value={filters.severity}
          onChange={(e) => apply({ severity: e.target.value })}
          className="min-h-11 rounded-[10px] border border-[#1c1915]/12 bg-[var(--mg-card)] px-3 text-sm"
          aria-label="Severity"
        >
          <option value="all">All severities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
        </select>
        <select
          value={filters.guideId}
          onChange={(e) => apply({ guide: e.target.value })}
          className="min-h-11 rounded-[10px] border border-[#1c1915]/12 bg-[var(--mg-card)] px-3 text-sm"
          aria-label="Guide"
        >
          <option value="all">All Guides</option>
          {guides.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={filters.dateFrom}
          onChange={(e) => apply({ from: e.target.value })}
          className="min-h-11 rounded-[10px] border border-[#1c1915]/12 bg-[var(--mg-card)] px-3 text-sm"
          aria-label="From date"
        />
        <input
          type="date"
          value={filters.dateTo}
          onChange={(e) => apply({ to: e.target.value })}
          className="min-h-11 rounded-[10px] border border-[#1c1915]/12 bg-[var(--mg-card)] px-3 text-sm"
          aria-label="To date"
        />
        <Button type="submit" variant="primary" size="sm">
          Find
        </Button>
      </form>

      {rows.length === 0 ? (
        <p className="py-6 text-sm text-[var(--mg-muted)]">No incidents match these filters.</p>
      ) : (
        <div className="mg-list overflow-x-auto px-3.5 py-2">
          <div className="mb-1 hidden grid-cols-[6.4rem_4.4rem_minmax(8rem,1fr)_minmax(6rem,0.7fr)_minmax(6rem,0.7fr)_5.2rem_minmax(8rem,1.2fr)_7.2rem] gap-x-3 px-1 text-[10px] font-semibold tracking-[0.12em] text-[var(--mg-muted)] uppercase xl:grid">
            <span>When</span>
            <span>Severity</span>
            <span>Type</span>
            <span>Child</span>
            <span>Guide</span>
            <span>Study Hall</span>
            <span>What happened</span>
            <span>Resolution</span>
          </div>
          <ul>
            {rows.map((row) => (
              <li key={row.id} className="mg-list-row">
                <Link
                  href={row.href}
                  className="grid grid-cols-1 items-baseline gap-x-3 gap-y-1 py-2.5 xl:grid-cols-[6.4rem_4.4rem_minmax(8rem,1fr)_minmax(6rem,0.7fr)_minmax(6rem,0.7fr)_5.2rem_minmax(8rem,1.2fr)_7.2rem]"
                >
                  <p className="text-[13px] tabular-nums text-[var(--mg-ink)]">
                    {row.occurredAt || row.opened_at ? (
                      <>
                        <span className="xl:hidden text-[var(--mg-muted)]">When · </span>
                        {formatDayHeading(row.occurredAt ?? row.opened_at ?? "", tz)}{" "}
                        {formatTime(row.occurredAt ?? row.opened_at ?? "", tz)}
                      </>
                    ) : (
                      "—"
                    )}
                  </p>
                  <p className={cn("text-[13px] font-medium", SEVERITY_TONE[row.severity] ?? "text-[var(--mg-ink)]")}>
                    <span className="xl:hidden text-[var(--mg-muted)] font-normal">Severity · </span>
                    {severityLabel(row.severity)}
                  </p>
                  <p className="truncate text-[13px] font-medium text-[var(--mg-ink)]" title={row.typeLabel}>
                    {row.typeLabel}
                  </p>
                  <p className="truncate text-[13px] text-[var(--mg-ink)]" title={row.childName}>
                    <span className="xl:hidden text-[var(--mg-muted)]">Child · </span>
                    {row.childName}
                  </p>
                  <p className="truncate text-[13px] text-[var(--mg-muted)]" title={row.guideName ?? undefined}>
                    <span className="xl:hidden">Guide · </span>
                    {row.guideName ?? "—"}
                  </p>
                  <p className="text-[13px] tabular-nums text-[var(--mg-muted)]">
                    {row.scheduledStart ? formatTime(row.scheduledStart, tz) : "—"}
                  </p>
                  <p className="truncate text-[13px] text-[var(--mg-muted)]" title={row.description}>
                    {row.description}
                  </p>
                  <p className={cn("text-[13px]", row.status === "open" ? "font-medium text-[var(--mg-attention)]" : "text-[var(--mg-ink)]")}>
                    {row.resolutionLabel}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[14px] bg-[var(--mg-card)] px-3.5 py-3 ring-1 ring-[#1c1915]/[0.06]">
      <p className="text-[10px] font-semibold tracking-[0.12em] text-[var(--mg-muted)] uppercase">{label}</p>
      <p className="mt-1 font-display text-[1.55rem] font-semibold leading-none tracking-[-0.04em] text-[var(--mg-ink)]">
        {value}
      </p>
    </div>
  );
}
