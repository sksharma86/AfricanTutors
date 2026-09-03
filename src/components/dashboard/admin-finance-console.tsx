"use client";

import { useMemo, useState } from "react";

import { AdminWhen } from "@/components/dashboard/admin-when";
import { Button, LinkButton } from "@/components/ui/button";
import { adminRecordingViewerPath } from "@/lib/recording-viewer.mjs";
import { ManagementSubnav } from "@/components/dashboard/management-subnav";
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

type Tab = "earnings" | "disputes" | "payments" | "customer";

const FINANCE_TABS: { id: Tab; label: string }[] = [
  { id: "earnings", label: "Guide compensation" },
  { id: "payments", label: "Customer money" },
  { id: "customer", label: "Customer balances" },
  { id: "disputes", label: "Disputes" },
];

export function AdminFinanceConsole({
  earnings: initialEarnings,
  guides: initialGuides = [],
  disputes: initialDisputes,
  payments: initialPayments,
}: {
  earnings: EarningRow[];
  guides?: GuideCompRow[];
  disputes: DisputeRow[];
  payments: PaymentRow[];
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
      <ManagementSubnav
        ariaLabel="Finance views"
        items={FINANCE_TABS}
        value={tab}
        onChange={(id) => setTab(id as Tab)}
      />
      {msg ? <div className="rounded-lg border border-gold-200 bg-gold-50 p-3 text-sm text-gold-800">{msg}</div> : null}
      {err ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</div> : null}

      {tab === "earnings" ? (
        <EarningsTab supabase={supabase} rows={initialEarnings} guides={initialGuides} onOk={flash} onErr={fail} />
      ) : null}
      {tab === "disputes" ? <DisputesTab rows={initialDisputes} payments={initialPayments} onOk={flash} onErr={fail} /> : null}
      {tab === "payments" ? <PaymentsTab rows={initialPayments} onOk={flash} onErr={fail} /> : null}
      {tab === "customer" ? <CustomerTab supabase={supabase} onOk={flash} onErr={fail} /> : null}
    </div>
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
    <section>
      <div>
        <h3 className="font-display text-[1.2rem] font-semibold tracking-[-0.03em] text-[var(--mg-ink)]">Guide compensation</h3>
        <p className="mt-1 text-[12.5px] text-[var(--mg-muted)]">
          Compensation is recorded in each Guide&apos;s payout currency. Mixed currencies are never added together.
        </p>
      </div>
      {totals.length > 0 ? (
        <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
          {totals.map((t) => (
            <div key={t.currency} className="mg-currency-card px-4 py-3">
              <p className="text-[10px] font-semibold tracking-[0.14em] text-[var(--mg-muted)] uppercase">{t.currency}</p>
              <dl className="mt-2 grid grid-cols-3 gap-2 text-[13px]">
                <div>
                  <dt className="text-[var(--mg-muted)]">Earned</dt>
                  <dd className="mt-0.5 font-medium text-[var(--mg-ink)]">{formatCompensationMinor(t.earned, t.currency)}</dd>
                </div>
                <div>
                  <dt className="text-[var(--mg-muted)]">Outstanding</dt>
                  <dd className="mt-0.5 font-medium text-[var(--mg-ink)]">{formatCompensationMinor(t.outstanding, t.currency)}</dd>
                </div>
                <div>
                  <dt className="text-[var(--mg-muted)]">Paid</dt>
                  <dd className="mt-0.5 font-medium text-[var(--mg-ink)]">{formatCompensationMinor(t.paid, t.currency)}</dd>
                </div>
              </dl>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-[var(--mg-muted)]">
          Earned {formatCompensationTotals(totals, "earned")} · Outstanding {formatCompensationTotals(totals, "outstanding")}
        </p>
      )}
      {guideRows.length > 0 ? (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr>
                <th>Guide</th>
                <th>Rate</th>
                <th>Earned</th>
                <th>Outstanding</th>
                <th>Paid</th>
              </tr>
            </thead>
            <tbody>
              {guideRows.map((g) => (
                <tr key={g.profile_id}>
                  <td className="font-medium">{g.name}</td>
                  <td>
                    {typeof g.rate_cents === "number" ? formatCompensationHourly(g.rate_cents, g.currency) : "Not set"}
                  </td>
                  <td>{formatCompensationTotals(g.totals, "earned")}</td>
                  <td>{formatCompensationTotals(g.totals, "outstanding")}</td>
                  <td>{formatCompensationTotals(g.totals, "paid")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-[10px] border border-[#1c1915]/12 px-3 py-1.5 text-sm">
          {["all", "earned", "adjusted", "paid", "voided", "pending"].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        {selected.size > 0 ? (
          <div className="inline-flex min-h-10 items-center gap-3 rounded-[10px] bg-[#161c18] px-3 text-[13px] text-[#f6f1e8]">
            <span>{selected.size} earning{selected.size === 1 ? "" : "s"} selected</span>
            <Button size="sm" variant="primary" onClick={markPaidBatch}>Mark paid</Button>
          </div>
        ) : (
          <Button size="sm" variant="outline" onClick={markPaidBatch} disabled>Mark selected paid (0)</Button>
        )}
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead>
            <tr><th></th><th>Guide</th><th>Session</th><th>Min</th><th>Rate</th><th>Amount</th><th>Status</th><th>Actions</th></tr>
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
                  <div className="flex flex-wrap gap-1.5">
                    {e.status !== "paid" && e.status !== "voided" ? (
                      <Button type="button" variant="primary" size="sm" onClick={() => markPaid(e.id)}>
                        Pay
                      </Button>
                    ) : null}
                    {e.status !== "paid" && e.status !== "voided" ? (
                      <Button type="button" variant="outline" size="sm" onClick={() => adjust(e.id)}>
                        Adjust
                      </Button>
                    ) : null}
                    {e.status !== "paid" && e.status !== "voided" ? (
                      <Button type="button" variant="destructive" size="sm" onClick={() => voidEarning(e.id)}>
                        Void
                      </Button>
                    ) : null}
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
    <section>
      <h3 className="font-display text-[1.2rem] font-semibold tracking-[-0.03em] text-[var(--mg-ink)]">Dispute queue</h3>
      <p className="mt-1 text-sm text-[var(--mg-muted)]">{active.length} awaiting review · {disputes.length} total</p>
      <div className="mt-4 divide-y divide-ink-100">
        {active.length === 0 ? <p className="py-6 text-sm text-ink-400">No open disputes.</p> : null}
        {active.map((d) => (
          <div key={d.id} className="py-4">
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
    <section>
      <h3 className="font-display text-[1.2rem] font-semibold tracking-[-0.03em] text-[var(--mg-ink)]">Customer money</h3>
      <p className="mt-1 text-sm text-[var(--mg-muted)]">USD through Stripe. Separate from Guide compensation.</p>
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
                  <td className="py-2">
                    {refundable > 0 ? (
                      <Button type="button" variant="destructive" size="sm" onClick={() => refund(p)}>
                        Refund
                      </Button>
                    ) : null}
                  </td>
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
    <section>
      <h3 className="font-display text-[1.2rem] font-semibold tracking-[-0.03em] text-[var(--mg-ink)]">Customer balances</h3>
      <p className="mt-1 text-sm text-[var(--mg-muted)]">Prepaid hours do not expire. Look up an account to view balances and make audited adjustments.</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <input value={accountId} onChange={(e) => setAccountId(e.target.value)} placeholder="Account id (UUID)" className="min-w-[320px] flex-1 rounded-lg border border-ink-200 px-3 py-2 text-sm" />
        <Button size="sm" variant="outline" onClick={load}>Load</Button>
      </div>
      {bal ? (
        <div className="mt-5 space-y-5">
          <div className="flex flex-wrap items-center gap-4 text-sm text-ink-700">
            <span>Package minutes: <b className="text-ink-900">{bal.minutes}</b></span>
            <span>Account credit: <b className="text-ink-900">{formatCents(bal.credit)}</b></span>
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
    <div>
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
  if (recordings.length === 0) {
    return <p className="mt-2 text-xs text-ink-400">Recording: none available yet (may still be processing).</p>;
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
            <LinkButton key={r.id} href={adminRecordingViewerPath(r.id)} variant="outline" size="sm">
              Review recording{mins}{until}
            </LinkButton>
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
  const tone = s === "paid" || s === "succeeded" ? "text-gold-800"
    : s === "voided" || s === "failed" || s === "canceled" ? "text-red-700"
    : s === "refunded" || s === "partially_refunded" ? "text-ink-700"
    : "text-ink-600";
  return (
    <span data-kind="status" className={`cursor-default text-xs font-medium ${tone}`}>
      {s}
    </span>
  );
}
