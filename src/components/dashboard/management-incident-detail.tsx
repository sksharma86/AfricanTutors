"use client";

import Link from "next/link";

import { ManagementSurface } from "@/components/dashboard/management-surface";
import { LinkButton } from "@/components/ui/button";
import { PortalTextLink } from "@/components/ui/portal-text-link";
import { formatDayHeading, formatTime } from "@/lib/timezone";
import { cn } from "@/lib/utils";

export function ManagementIncidentDetail({
  incident,
  timeZone,
}: {
  incident: {
    id: string;
    typeLabel: string;
    status: "open" | "resolved";
    severity: string;
    resolutionLabel: string;
    resolution_type: string | null;
    resolution_source: string | null;
    childName: string;
    parentName: string | null;
    guideName: string | null;
    scheduledStart: string | null;
    description: string;
    customerImpact: string;
    parentNotification: { kind: string; at: string | null; type: string | null };
    complementaryHour: boolean;
    studyHallHref: string;
    timeline: { at: string; title: string; detail: string | null }[];
    opened_at: string | null;
    resolved_at: string | null;
  };
  timeZone: string;
}) {
  const tz = timeZone;
  const parentNote =
    incident.parentNotification.kind === "sent"
      ? "Parent notified"
      : incident.parentNotification.kind === "failed"
        ? "Parent notification failed"
        : incident.resolution_type === "guide_replaced"
          ? "None required"
          : "None in records";

  return (
    <div className="space-y-5">
      <p>
        <PortalTextLink href="/dashboard/admin/incidents">← Incident History</PortalTextLink>
      </p>

      <header className="border-b border-ink-100 pb-5">
        <p className="text-[10px] font-semibold tracking-[0.14em] text-[var(--mg-muted)] uppercase">
          {incident.severity === "critical" ? "Critical" : incident.severity === "high" ? "High" : "Medium"}
          {" · "}
          {incident.typeLabel}
        </p>
        <h1 className="mt-1 font-display text-[1.45rem] font-semibold tracking-[-0.03em] text-[var(--mg-ink)]">
          {incident.childName}
        </h1>
        <p className="mt-1 text-sm text-[var(--mg-muted)]">
          {[incident.guideName, incident.scheduledStart ? `${formatDayHeading(incident.scheduledStart, tz)} ${formatTime(incident.scheduledStart, tz)}` : null]
            .filter(Boolean)
            .join(" · ") || "Study Hall"}
        </p>
        <p className={cn("mt-2 text-sm font-medium", incident.status === "open" ? "text-[var(--mg-attention)]" : "text-[var(--mg-ink)]")}>
          {incident.resolutionLabel}
        </p>
        <p className="mt-1 text-sm text-[var(--mg-muted)]">{incident.description}</p>
      </header>

      <ManagementSurface>
        <p className="text-[10px] font-semibold tracking-[0.14em] text-[var(--mg-muted)] uppercase">What happened</p>
        {incident.timeline.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--mg-muted)]">
            This incident is recorded, but the system does not have enough timestamps to reconstruct a full timeline.
          </p>
        ) : (
          <ol className="mt-3 divide-y divide-[#1c1915]/[0.06]">
            {incident.timeline.map((event, index) => (
              <li key={`${event.at}-${event.title}-${index}`} className="grid grid-cols-[5.2rem_minmax(0,1fr)] gap-3 py-2.5">
                <p className="text-[13px] tabular-nums text-[var(--mg-muted)]">{formatTime(event.at, tz)}</p>
                <div>
                  <p className="text-[13px] font-medium text-[var(--mg-ink)]">{event.title}</p>
                  {event.detail ? <p className="mt-0.5 text-[12.5px] text-[var(--mg-muted)]">{event.detail}</p> : null}
                </div>
              </li>
            ))}
          </ol>
        )}
      </ManagementSurface>

      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-[10px] font-semibold tracking-[0.12em] text-[var(--mg-muted)] uppercase">Parent notification</dt>
          <dd className="mt-1 text-[var(--mg-ink)]">{parentNote}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold tracking-[0.12em] text-[var(--mg-muted)] uppercase">Customer impact</dt>
          <dd className="mt-1 text-[var(--mg-ink)]">{incident.customerImpact}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold tracking-[0.12em] text-[var(--mg-muted)] uppercase">Opened</dt>
          <dd className="mt-1 text-[var(--mg-ink)]">
            {incident.opened_at ? `${formatDayHeading(incident.opened_at, tz)} ${formatTime(incident.opened_at, tz)}` : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold tracking-[0.12em] text-[var(--mg-muted)] uppercase">Resolved</dt>
          <dd className="mt-1 text-[var(--mg-ink)]">
            {incident.resolved_at ? `${formatDayHeading(incident.resolved_at, tz)} ${formatTime(incident.resolved_at, tz)}` : "Still open"}
          </dd>
        </div>
        {incident.parentName ? (
          <div>
            <dt className="text-[10px] font-semibold tracking-[0.12em] text-[var(--mg-muted)] uppercase">Parent</dt>
            <dd className="mt-1 text-[var(--mg-ink)]">{incident.parentName}</dd>
          </div>
        ) : null}
        {incident.complementaryHour ? (
          <div>
            <dt className="text-[10px] font-semibold tracking-[0.12em] text-[var(--mg-muted)] uppercase">Recovery</dt>
            <dd className="mt-1 text-[var(--mg-ink)]">+1 complimentary hour</dd>
          </div>
        ) : null}
      </dl>

      <div className="flex flex-wrap gap-2">
        <LinkButton href={incident.studyHallHref} variant="outline" size="sm">
          Open Study Hall
        </LinkButton>
        {incident.status === "open" ? (
          <LinkButton href={incident.studyHallHref} variant="primary" size="sm">
            Review now
          </LinkButton>
        ) : null}
      </div>
    </div>
  );
}

export function ManagementIncidentNotFound() {
  return (
    <div>
      <p>
        <Link href="/dashboard/admin/incidents" className="text-sm font-medium text-ink-500 hover:text-ink-800">
          ← Incident History
        </Link>
      </p>
      <p className="mt-6 text-sm text-[var(--mg-muted)]">This incident is not available from current operational records.</p>
    </div>
  );
}
