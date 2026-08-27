"use client";

import { useMemo, useState } from "react";

import { AdminWhen } from "@/components/dashboard/admin-when";
import { Button } from "@/components/ui/button";
import {
  aggregateCompensationByCurrency,
  formatCompensationHourly,
  formatCompensationMinor,
  formatCompensationTotals,
  summarizeGuideCompensation,
} from "@/lib/compensation-currency.mjs";
import { formatCents } from "@/lib/pricing";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export interface EarningRow {
  id: string;
  tutor_id: string;
  booking_id: string | null;
  duration_minutes: number;
  rate_cents_per_hour: number;
  amount_cents: number;
  currency?: string | null;
  status: string;
  earned_at: string | null;
  paid_at: string | null;
  adjusted_from_cents: number | null;
  reason: string | null;
  tutor_name?: string;
  subject?: string | null;
  when?: string | null;
}

export interface GuideCompRow {
  profile_id: string;
  name: string;
  rate_cents: number | null;
  currency: string;
}

interface GuideLedgerRow extends GuideCompRow {
  totals: { currency: string; earned: number; paid: number; outstanding: number }[];
}
export interface DisputeRow {
  id: string;
  booking_id: string;
  account_id: string;
  tutor_id: string | null;
  category: string;
  complaint: string | null;
  status: string;
  resolution: string | null;
  created_at: string;
  reviewed_at: string | null;
  ref?: string | null;
  subject?: string | null;
  when?: string | null;
  tutor_name?: string | null;
  recordings?: {
    id: string;
    status: string;
    duration_seconds: number | null;
    completed_at: string | null;
    retention_until?: string | null;
    deleted_at?: string | null;
  }[];
}
export interface PaymentRow {
  id: string;
  account_id: string;
  purpose: string;
  gross_cents: number;
  stripe_paid_cents: number;
  credit_applied_cents: number;
  refunded_cents: number;
  status: string;
  booking_id: string | null;
  ref?: string | null;
}

export interface EmailFailureRow {
  id: string;
  notification_type: string;
  to_email: string | null;
  status: string;
  error: string | null;
  updated_at: string;
}

type Tab = "earnings" | "disputes" | "payments" | "customer" | "notifications";

export function AdminFinanceConsole({
  earnings: initialEarnings,
  guides: initialGuides = [],
  disputes: initialDisputes,
  payments: initialPayments,
  emailFailures = [],
}: {
  earnings: EarningRow[];
  guides?: GuideCompRow[];
  disputes: DisputeRow[];
  payments: PaymentRow[];
  emailFailures?: EmailFailureRow[];
}) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [tab, setTab] = useState<Tab>("earnings");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const flash = (m: string) => { setMsg(m); setErr(null); };
  const fail = (m: string) => { setErr(m); setMsg(null); };

  if (!supabase) {
    return <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">Supabase is not configured.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {(["earnings", "disputes", "payments", "customer", "notifications"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-full border px-4 py-1.5 text-sm capitalize ${tab === t ? "border-ink-900 bg-ink-900 text-white" : "border-ink-200 text-ink-700 hover:border-ink-300"}`}
          >
            {t === "customer" ? "Customer finance" : t}
          </button>
        ))}
      </div>
      {msg ? <div className="rounded-lg border border-gold-200 bg-gold-50 p-3 text-sm text-gold-800">{msg}</div> : null}
      {err ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</div> : null}

      {tab === "earnings" ? (
        <EarningsTab supabase={supabase} rows={initialEarnings} guides={initialGuides} onOk={flash} onErr={fail} />
      ) : null}
      {tab === "disputes" ? <DisputesTab rows={initialDisputes} payments={initialPayments} onOk={flash} onErr={fail} /> : null}
      {tab === "payments" ? <PaymentsTab rows={initialPayments} onOk={flash} onErr={fail} /> : null}
      {tab === "customer" ? <CustomerTab supabase={supabase} onOk={flash} onErr={fail} /> : null}
      {tab === "notifications" ? <NotificationsTab rows={emailFailures} /> : null}
    </div>
  );
}

function NotificationsTab({ rows: initial }: { rows: EmailFailureRow[] }) {
  const [rows, setRows] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function retry(id: string) {
    setBusy(id);
    setNote(null);
    const res = await fetch("/api/admin/notifications/retry", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deliveryId: id }) });
    const data = await res.json().catch(() => null);
    setBusy(null);
    if (res.ok && data?.retried) {
      setRows((p) => p.filter((r) => r.id !== id)); // no longer a failure
      setNote(data.status === "sent" ? "Notification resent." : `Retry recorded (${data.status}).`);
    } else {
      setNote(data?.reason ?? data?.error ?? "Retry failed.");
    }
  }

  return (
    <section className="rounded-2xl border border-ink-100 bg-white p-6">
      <h3 className="font-display text-lg font-semibold text-ink-900">Notification failures</h3>
      <p className="mt-1 text-sm text-ink-500">Transactional emails that failed to send. Business actions completed normally regardless. Retry re-sends the same message; it never re-runs the underlying operation.</p>
      {note ? <p className="mt-2 rounded-lg border border-ink-200 bg-ink-50 p-2 text-sm text-ink-700">{note}</p> : null}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-ink-400">
            <tr><th className="py-2 pr-3">Type</th><th className="py-2 pr-3">Recipient</th><th className="py-2 pr-3">Status</th><th className="py-2 pr-3">Error</th><th className="py-2 pr-3">When</th><th className="py-2"></th></tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {rows.length === 0 ? (
              <tr><td colSpan={6} className="py-6 text-center text-ink-400">No notification failures.</td></tr>
            ) : rows.map((r) => (
              <tr key={r.id}>
                <td className="py-2 pr-3 text-ink-800">{r.notification_type}</td>
                <td className="py-2 pr-3 text-ink-600">{r.to_email ?? "—"}</td>
                <td className="py-2 pr-3"><StatusPill s={r.status} /></td>
                <td className="py-2 pr-3 text-ink-500">{r.error ?? ""}</td>
                <td className="py-2 pr-3 text-ink-400">{new Date(r.updated_at).toLocaleString()}</td>
                <td className="py-2"><button onClick={() => retry(r.id)} disabled={busy === r.id} className="text-xs font-medium text-gold-700 hover:underline disabled:opacity-50">{busy === r.id ? "Retrying…" : "Retry"}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

type SB = NonNullable<ReturnType<typeof createSupabaseBrowserClient>>;

function EarningsTab({
  supabase,
  rows,
  guides,
  onOk,
  onErr,
}: {
  supabase: SB;
  rows: EarningRow[];
  guides: GuideCompRow[];
  onOk: (m: string) => void;
  onErr: (m: string) => void;
}) {
  const [earnings, setEarnings] = useState(rows);
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = earnings.filter((e) => statusFilter === "all" || e.status === statusFilter);
  const totals = useMemo(() => aggregateCompensationByCurrency(earnings), [earnings]);
  const guideRows = useMemo(
    () => summarizeGuideCompensation(guides, earnings) as GuideLedgerRow[],
    [guides, earnings],
  );

  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  async function markPaidBatch() {
    const ids = [...selected];
    if (ids.length === 0) return;
    const { error } = await supabase.rpc("admin_mark_earnings_paid_batch", { p_ids: ids, p_note: "batch payout" });
    if (error) return onErr(error.message);
    setEarnings((p) => p.map((e) => (selected.has(e.id) && e.status !== "voided" && e.status !== "paid" ? { ...e, status: "paid", paid_at: new Date().toISOString() } : e)));
    setSelected(new Set());
    onOk(`Marked ${ids.length} earning(s) paid.`);
  }
  async function markPaid(id: string) {
    const { data, error } = await supabase.rpc("admin_mark_earning_paid", { p_earning_id: id, p_note: "manual payout" });
    if (error) return onErr(error.message);
    if (data?.status === "paid") setEarnings((p) => p.map((e) => (e.id === id ? { ...e, status: "paid", paid_at: new Date().toISOString() } : e)));
    onOk("Earning marked paid.");
  }
  async function adjust(id: string) {
    const row = earnings.find((e) => e.id === id);
    const ccy = (row?.currency ?? "USD").toUpperCase();
    const val = window.prompt(`New earning amount in ${ccy} (e.g. 7.50). Do not convert currencies:`);
    if (val === null) return;
    const cents = Math.round(parseFloat(val) * 100);
    if (!Number.isFinite(cents) || cents < 0) return onErr("Invalid amount.");
    const reason = window.prompt("Reason for adjustment:") || "admin adjustment";
    const { error } = await supabase.rpc("admin_adjust_earning", { p_earning_id: id, p_new_amount_cents: cents, p_reason: reason });
    if (error) return onErr(error.message);
    setEarnings((p) => p.map((e) => (e.id === id ? { ...e, amount_cents: cents, adjusted_from_cents: e.adjusted_from_cents ?? e.amount_cents, status: "adjusted", reason } : e)));
    onOk("Earning adjusted.");
  }
  async function voidEarning(id: string) {
    const reason = window.prompt("Reason for voiding this earning:");
    if (!reason) return;
    const { error } = await supabase.rpc("admin_void_earning", { p_earning_id: id, p_reason: reason });
    if (error) return onErr(error.message);
    setEarnings((p) => p.map((e) => (e.id === id ? { ...e, status: "voided", reason } : e)));
    onOk("Earning voided.");
  }

  return (
    <section className="rounded-2xl border border-ink-100 bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-semibold text-ink-900">Guide earnings</h3>
          <p className="mt-1 text-xs text-ink-400">
            Compensation is recorded in each Guide&apos;s payout currency. Mixed currencies are never added together.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 text-sm">
          <span className="rounded-full border border-ink-200 px-3 py-1">Earned {formatCompensationTotals(totals, "earned")}</span>
          <span className="rounded-full border border-ink-200 px-3 py-1">Paid {formatCompensationTotals(totals, "paid")}</span>
          <span className="rounded-full border border-gold-200 bg-gold-50 px-3 py-1 text-gold-800">
            Outstanding {formatCompensationTotals(totals, "outstanding")}
          </span>
        </div>
      </div>
      {guideRows.length > 0 ? (
        <div className="mt-5 overflow-x-auto rounded-xl border border-ink-100">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-ink-400">
              <tr>
                <th className="px-3 py-2">Guide</th>
                <th className="px-3 py-2">Rate</th>
                <th className="px-3 py-2">Earned</th>
                <th className="px-3 py-2">Outstanding</th>
                <th className="px-3 py-2">Paid</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {guideRows.map((g) => (
                <tr key={g.profile_id}>
                  <td className="px-3 py-2 font-medium text-ink-900">{g.name}</td>
                  <td className="px-3 py-2 text-ink-700">
                    {typeof g.rate_cents === "number" ? formatCompensationHourly(g.rate_cents, g.currency) : "Not set"}
                  </td>
                  <td className="px-3 py-2 text-ink-800">{formatCompensationTotals(g.totals, "earned")}</td>
                  <td className="px-3 py-2 text-gold-800">{formatCompensationTotals(g.totals, "outstanding")}</td>
                  <td className="px-3 py-2 text-ink-800">{formatCompensationTotals(g.totals, "paid")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <div className="mt-4 flex items-center gap-3">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-lg border border-ink-200 px-3 py-1.5 text-sm">
          {["all", "earned", "adjusted", "paid", "voided", "pending"].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <Button size="sm" variant="outline" onClick={markPaidBatch} disabled={selected.size === 0}>Mark selected paid ({selected.size})</Button>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-ink-400">
            <tr><th className="py-2 pr-3"></th><th className="py-2 pr-3">Guide</th><th className="py-2 pr-3">Session</th><th className="py-2 pr-3">Min</th><th className="py-2 pr-3">Rate</th><th className="py-2 pr-3">Amount</th><th className="py-2 pr-3">Status</th><th className="py-2">Actions</th></tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {filtered.length === 0 ? (
              <tr><td colSpan={8} className="py-6 text-center text-ink-400">No earnings.</td></tr>
            ) : filtered.map((e) => (
              <tr key={e.id}>
                <td className="py-2 pr-3">{e.status === "earned" || e.status === "adjusted" || e.status === "pending" ? <input type="checkbox" checked={selected.has(e.id)} onChange={() => toggle(e.id)} /> : null}</td>
                <td className="py-2 pr-3 text-ink-800">{e.tutor_name}</td>
                <td className="py-2 pr-3 text-ink-600">
                  {e.subject ?? "—"}
                  {e.when ? (
                    <>
                      {" · "}
                      <AdminWhen iso={e.when} className="inline-block align-baseline" />
                    </>
                  ) : null}
                </td>
                <td className="py-2 pr-3 text-ink-600">{e.duration_minutes}</td>
                <td className="py-2 pr-3 text-ink-600">
                  {formatCompensationHourly(e.rate_cents_per_hour, e.currency ?? "USD")}
                </td>
                <td className="py-2 pr-3 font-medium text-ink-900">
                  {formatCompensationMinor(e.amount_cents, e.currency ?? "USD")}
                  {e.adjusted_from_cents != null ? (
                    <span className="ml-1 text-xs text-ink-400 line-through">
                      {formatCompensationMinor(e.adjusted_from_cents, e.currency ?? "USD")}
                    </span>
                  ) : null}
                </td>
                <td className="py-2 pr-3"><StatusPill s={e.status} /></td>
                <td className="py-2">
                  <div className="flex gap-2 text-xs">
                    {e.status !== "paid" && e.status !== "voided" ? <button onClick={() => markPaid(e.id)} className="font-medium text-gold-700 hover:underline">Pay</button> : null}
                    {e.status !== "paid" && e.status !== "voided" ? <button onClick={() => adjust(e.id)} className="font-medium text-ink-600 hover:underline">Adjust</button> : null}
                    {e.status !== "paid" && e.status !== "voided" ? <button onClick={() => voidEarning(e.id)} className="font-medium text-red-600 hover:underline">Void</button> : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function DisputesTab({ rows, payments, onOk, onErr }: { rows: DisputeRow[]; payments: PaymentRow[]; onOk: (m: string) => void; onErr: (m: string) => void }) {
  const [disputes, setDisputes] = useState(rows);
  const active = disputes.filter((d) => d.status === "open" || d.status === "under_review");
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <section className="rounded-2xl border border-ink-100 bg-white p-6">
      <h3 className="font-display text-lg font-semibold text-ink-900">Dispute queue</h3>
      <p className="mt-1 text-sm text-ink-500">{active.length} awaiting review · {disputes.length} total</p>
      <div className="mt-4 space-y-3">
        {active.length === 0 ? <p className="rounded-lg border border-dashed border-ink-200 px-4 py-6 text-center text-sm text-ink-400">No open disputes.</p> : null}
        {active.map((d) => (
          <div key={d.id} className="rounded-xl border border-ink-100 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-ink-900">{d.subject ?? "Session"} · {d.category}</p>
                <p className="text-xs text-ink-500">
                  {d.ref ? `Ref ${d.ref} · ` : ""}
                  {d.when ? <AdminWhen iso={d.when} className="inline-block align-baseline" /> : null}
                  {d.tutor_name ? ` · Guide ${d.tutor_name}` : ""}
                </p>
                {d.complaint ? <p className="mt-1 text-sm text-ink-600">“{d.complaint}”</p> : null}
                <RecordingStatus recordings={d.recordings ?? []} onErr={onErr} />
              </div>
              <Button size="sm" variant="outline" onClick={() => setOpenId(openId === d.id ? null : d.id)}>{openId === d.id ? "Close" : "Resolve"}</Button>
            </div>
            {openId === d.id ? (
              <ResolveForm
                dispute={d}
                payments={payments.filter((p) => p.account_id === d.account_id)}
                onDone={(status) => { setDisputes((p) => p.map((x) => (x.id === d.id ? { ...x, status: status === "denied" ? "denied" : "resolved" } : x))); setOpenId(null); onOk("Dispute resolved."); }}
                onErr={onErr}
              />
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

function ResolveForm({ dispute, payments, onDone, onErr }: { dispute: DisputeRow; payments: PaymentRow[]; onDone: (s: string) => void; onErr: (m: string) => void }) {
  const [resolution, setResolution] = useState("courtesy");
  const [credit, setCredit] = useState("");
  const [minutes, setMinutes] = useState("");
  const [refundPaymentId, setRefundPaymentId] = useState(payments[0]?.id ?? "");
  const [refund, setRefund] = useState("");
  const [earningAction, setEarningAction] = useState("none");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    const dollarsToCents = (v: string) => (v ? Math.round(parseFloat(v) * 100) : 0);
    const res = await fetch("/api/admin/dispute", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        disputeId: dispute.id, resolution, notes,
        creditCents: dollarsToCents(credit), restoreMinutes: minutes ? parseInt(minutes, 10) : 0,
        refundCents: dollarsToCents(refund), refundPaymentId: refund ? refundPaymentId : null,
        earningAction: earningAction === "none" ? null : earningAction,
      }),
    });
    const payload = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) return onErr(payload?.error ?? "Resolution failed.");
    onDone(resolution);
  }

  return (
    <div className="mt-4 grid gap-3 rounded-lg border border-ink-100 bg-ink-50/50 p-4 sm:grid-cols-2">
      <label className="text-sm">Resolution
        <select value={resolution} onChange={(e) => setResolution(e.target.value)} className="mt-1 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm">
          <option value="denied">Denied</option><option value="courtesy">Courtesy</option><option value="upheld">Upheld</option>
        </select>
      </label>
      <label className="text-sm">Account credit ($)
        <input value={credit} onChange={(e) => setCredit(e.target.value)} placeholder="0" className="mt-1 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm" />
      </label>
      <label className="text-sm">Restore package minutes
        <input value={minutes} onChange={(e) => setMinutes(e.target.value)} placeholder="0" className="mt-1 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm" />
      </label>
      <label className="text-sm">Stripe refund ($)
        <input value={refund} onChange={(e) => setRefund(e.target.value)} placeholder="0" className="mt-1 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm" />
      </label>
      {refund ? (
        <label className="text-sm sm:col-span-2">Refund payment
          <select value={refundPaymentId} onChange={(e) => setRefundPaymentId(e.target.value)} className="mt-1 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm">
            {payments.map((p) => <option key={p.id} value={p.id}>{p.purpose} · paid {formatCents(p.stripe_paid_cents)} · refundable {formatCents(p.stripe_paid_cents - p.refunded_cents)}</option>)}
          </select>
        </label>
      ) : null}
      <label className="text-sm">Guide earning
        <select value={earningAction} onChange={(e) => setEarningAction(e.target.value)} className="mt-1 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm">
          <option value="none">Leave intact</option><option value="void">Void</option>
        </select>
      </label>
      <label className="text-sm sm:col-span-2">Admin notes (not shown to customer)
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm" />
      </label>
      <div className="sm:col-span-2">
        <Button size="sm" onClick={submit} disabled={busy}>{busy ? "Resolving…" : "Apply resolution"}</Button>
      </div>
    </div>
  );
}

function PaymentsTab({ rows, onOk, onErr }: { rows: PaymentRow[]; onOk: (m: string) => void; onErr: (m: string) => void }) {
  const [payments, setPayments] = useState(rows);
  async function refund(p: PaymentRow) {
    const refundable = p.stripe_paid_cents - p.refunded_cents;
    if (refundable <= 0) return onErr("Nothing refundable on this payment.");
    const val = window.prompt(`Refund amount in dollars (max ${(refundable / 100).toFixed(2)}):`, (refundable / 100).toFixed(2));
    if (val === null) return;
    const cents = Math.round(parseFloat(val) * 100);
    if (!Number.isFinite(cents) || cents <= 0) return onErr("Invalid amount.");
    const reason = window.prompt("Reason for refund:") || "admin refund";
    const res = await fetch("/api/admin/refund", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paymentId: p.id, amountCents: cents, reason }) });
    const payload = await res.json().catch(() => null);
    if (!res.ok) return onErr(payload?.error ?? "Refund failed.");
    setPayments((prev) => prev.map((x) => (x.id === p.id ? { ...x, refunded_cents: payload.refunded_cents ?? x.refunded_cents } : x)));
    onOk(`Refund issued. Total refunded ${formatCents(payload.refunded_cents ?? cents)}.`);
  }
  return (
    <section className="rounded-2xl border border-ink-100 bg-white p-6">
      <h3 className="font-display text-lg font-semibold text-ink-900">Payments &amp; refunds</h3>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-ink-400">
            <tr><th className="py-2 pr-3">Ref/Purpose</th><th className="py-2 pr-3">Gross</th><th className="py-2 pr-3">Stripe</th><th className="py-2 pr-3">Credit</th><th className="py-2 pr-3">Refunded</th><th className="py-2 pr-3">Refundable</th><th className="py-2 pr-3">Status</th><th className="py-2"></th></tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {payments.map((p) => {
              const refundable = p.stripe_paid_cents - p.refunded_cents;
              return (
                <tr key={p.id}>
                  <td className="py-2 pr-3 text-ink-800">{p.ref ?? p.purpose}</td>
                  <td className="py-2 pr-3 text-ink-600">{formatCents(p.gross_cents)}</td>
                  <td className="py-2 pr-3 text-ink-600">{formatCents(p.stripe_paid_cents)}</td>
                  <td className="py-2 pr-3 text-ink-600">{formatCents(p.credit_applied_cents)}</td>
                  <td className="py-2 pr-3 text-ink-600">{formatCents(p.refunded_cents)}</td>
                  <td className="py-2 pr-3 font-medium text-ink-900">{formatCents(refundable)}</td>
                  <td className="py-2 pr-3"><StatusPill s={p.status} /></td>
                  <td className="py-2">{refundable > 0 ? <button onClick={() => refund(p)} className="text-xs font-medium text-red-600 hover:underline">Refund</button> : null}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CustomerTab({ supabase, onOk, onErr }: { supabase: SB; onOk: (m: string) => void; onErr: (m: string) => void }) {
  const [accountId, setAccountId] = useState("");
  const [bal, setBal] = useState<{ minutes: number; credit: number } | null>(null);
  const [pkgLedger, setPkgLedger] = useState<{ minutes_delta: number; entry_type: string; reason: string | null; created_at: string }[]>([]);
  const [creditLedger, setCreditLedger] = useState<{ amount_cents: number; entry_type: string; reason: string | null; created_at: string }[]>([]);

  async function load() {
    setBal(null);
    if (!accountId.trim()) return;
    const [b, pk, cr] = await Promise.all([
      supabase.rpc("get_customer_balances", { p_account: accountId.trim() }),
      supabase.from("package_minute_ledger").select("minutes_delta, entry_type, reason, created_at").eq("account_id", accountId.trim()).order("created_at", { ascending: false }).limit(50),
      supabase.from("dollar_credit_ledger").select("amount_cents, entry_type, reason, created_at").eq("account_id", accountId.trim()).order("created_at", { ascending: false }).limit(50),
    ]);
    if (b.error) return onErr("Could not load balances (check the account id).");
    setBal({ minutes: b.data.package_minutes ?? 0, credit: b.data.dollar_credit_cents ?? 0 });
    setPkgLedger(pk.data ?? []);
    setCreditLedger(cr.data ?? []);
  }
  async function adjustCredit() {
    const val = window.prompt("Credit adjustment in dollars (negative to deduct):");
    if (val === null) return;
    const cents = Math.round(parseFloat(val) * 100);
    if (!Number.isFinite(cents) || cents === 0) return onErr("Invalid amount.");
    const reason = window.prompt("Reason:") || "admin adjustment";
    const res = await fetch("/api/admin/adjust-balance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "credit", accountId: accountId.trim(), amountCents: cents, reason }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) return onErr(data?.error ?? "Could not adjust credit.");
    onOk(cents > 0 ? "Credit adjusted (parent notified)." : "Credit adjusted.");
    load();
  }
  async function adjustMinutes() {
    const val = window.prompt("Minute adjustment (negative to deduct):");
    if (val === null) return;
    const m = parseInt(val, 10);
    if (!Number.isInteger(m) || m === 0) return onErr("Invalid amount.");
    const reason = window.prompt("Reason:") || "admin adjustment";
    const res = await fetch("/api/admin/adjust-balance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "minutes", accountId: accountId.trim(), minutes: m, reason }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) return onErr(data?.error ?? "Could not adjust minutes.");
    onOk("Minutes adjusted.");
    load();
  }

  return (
    <section className="rounded-2xl border border-ink-100 bg-white p-6">
      <h3 className="font-display text-lg font-semibold text-ink-900">Customer finance</h3>
      <p className="mt-1 text-sm text-ink-500">Look up an account by its id to view balances and ledgers, and make audited adjustments.</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <input value={accountId} onChange={(e) => setAccountId(e.target.value)} placeholder="Account id (UUID)" className="min-w-[320px] flex-1 rounded-lg border border-ink-200 px-3 py-2 text-sm" />
        <Button size="sm" variant="outline" onClick={load}>Load</Button>
      </div>
      {bal ? (
        <div className="mt-5 space-y-5">
          <div className="flex flex-wrap gap-3 text-sm">
            <span className="rounded-full border border-ink-200 px-3 py-1">Package minutes: <b>{bal.minutes}</b></span>
            <span className="rounded-full border border-ink-200 px-3 py-1">Account credit: <b>{formatCents(bal.credit)}</b></span>
            <Button size="sm" variant="outline" onClick={adjustCredit}>Adjust credit</Button>
            <Button size="sm" variant="outline" onClick={adjustMinutes}>Adjust minutes</Button>
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <Ledger title="Package-minute ledger" rows={pkgLedger.map((r) => ({ delta: `${r.minutes_delta > 0 ? "+" : ""}${r.minutes_delta} min`, type: r.entry_type, reason: r.reason, at: r.created_at }))} />
            <Ledger title="Dollar-credit ledger" rows={creditLedger.map((r) => ({ delta: `${r.amount_cents > 0 ? "+" : ""}${formatCents(r.amount_cents)}`, type: r.entry_type, reason: r.reason, at: r.created_at }))} />
          </div>
        </div>
      ) : null}
    </section>
  );
}

function Ledger({ title, rows }: { title: string; rows: { delta: string; type: string; reason: string | null; at: string }[] }) {
  return (
    <div className="rounded-xl border border-ink-100 p-4">
      <p className="text-sm font-semibold text-ink-800">{title}</p>
      <div className="mt-2 max-h-64 overflow-y-auto">
        <table className="w-full text-left text-xs">
          <tbody className="divide-y divide-ink-100">
            {rows.length === 0 ? <tr><td className="py-3 text-center text-ink-400">No entries.</td></tr> : rows.map((r, i) => (
              <tr key={i}><td className="py-1.5 pr-2 font-medium text-ink-900">{r.delta}</td><td className="py-1.5 pr-2 text-ink-500">{r.type}</td><td className="py-1.5 pr-2 text-ink-500">{r.reason ?? ""}</td><td className="py-1.5 text-ink-400">{new Date(r.at).toLocaleDateString()}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RecordingStatus({
  recordings,
  onErr,
}: {
  recordings: {
    id: string;
    status: string;
    duration_seconds: number | null;
    completed_at: string | null;
    retention_until?: string | null;
    deleted_at?: string | null;
  }[];
  onErr: (m: string) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  if (recordings.length === 0) {
    return <p className="mt-2 text-xs text-ink-400">Recording: none available yet (may still be processing).</p>;
  }
  async function review(id: string) {
    setBusy(id);
    const res = await fetch("/api/admin/recording/access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recordingId: id }),
    });
    const data = await res.json().catch(() => null);
    setBusy(null);
    if (!res.ok || !data?.url) {
      onErr(data?.error ?? "Could not open the recording.");
      return;
    }
    window.open(data.url as string, "_blank", "noopener,noreferrer");
  }
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
      <span className="font-medium text-ink-600">Recording:</span>
      {recordings.map((r) => {
        const mins = r.duration_seconds ? ` · ${Math.round(r.duration_seconds / 60)} min` : "";
        if (r.deleted_at) {
          return (
            <span key={r.id} className="rounded-full border border-ink-200 bg-ink-50 px-2.5 py-0.5 text-ink-500">
              Deleted (retention)
            </span>
          );
        }
        if (r.status === "failed") {
          return (
            <span key={r.id} className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-red-600">
              Recording failed
            </span>
          );
        }
        if (r.status === "completed") {
          const until = r.retention_until
            ? ` · until ${new Date(r.retention_until).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
            : "";
          return (
            <button
              key={r.id}
              onClick={() => review(r.id)}
              disabled={busy === r.id}
              className="rounded-full border border-gold-300 bg-gold-50 px-2.5 py-0.5 font-medium text-gold-700 hover:bg-gold-100 disabled:opacity-50"
            >
              {busy === r.id ? "Opening…" : `Review recording${mins}${until}`}
            </button>
          );
        }
        return (
          <span key={r.id} className="rounded-full border border-ink-200 bg-ink-50 px-2 py-0.5 text-ink-500">
            Recording processing{mins}
          </span>
        );
      })}
    </div>
  );
}

function StatusPill({ s }: { s: string }) {
  const tone = s === "paid" || s === "succeeded" ? "border-gold-200 bg-gold-50 text-gold-700"
    : s === "voided" || s === "failed" || s === "canceled" ? "border-red-200 bg-red-50 text-red-600"
    : s === "refunded" || s === "partially_refunded" ? "border-amber-300 bg-amber-50 text-amber-700"
    : "border-ink-200 bg-ink-50 text-ink-600";
  return <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${tone}`}>{s}</span>;
}
