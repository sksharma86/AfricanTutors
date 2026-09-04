import { ManagementPage } from "@/components/dashboard/management-page";
import { ManagementSurface } from "@/components/dashboard/management-surface";
import { ADMIN_PORTAL_NAV } from "@/components/dashboard/dashboard-shell";

/**
 * Presentational finance board for film. Fixture figures only. No ledger writes.
 */
export function FilmFinance() {
  return (
    <ManagementPage navItems={ADMIN_PORTAL_NAV} wide>
      <h1 className="font-display text-[1.35rem] font-semibold tracking-[-0.03em] text-[var(--mg-ink)]">
        Finance
      </h1>
      <p className="mt-1 text-sm text-[var(--mg-muted)]">Guide compensation and customer payments.</p>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <ManagementSurface>
          <p className="text-[10px] font-semibold tracking-[0.14em] text-[var(--mg-muted)] uppercase">
            Outstanding
          </p>
          <p className="mt-2 font-display text-2xl font-semibold text-[var(--mg-ink)]">$1,840</p>
          <p className="mt-1 text-sm text-[var(--mg-muted)]">Guide compensation awaiting payout</p>
        </ManagementSurface>
        <ManagementSurface>
          <p className="text-[10px] font-semibold tracking-[0.14em] text-[var(--mg-muted)] uppercase">Paid</p>
          <p className="mt-2 font-display text-2xl font-semibold text-[var(--mg-ink)]">$4,260</p>
          <p className="mt-1 text-sm text-[var(--mg-muted)]">This month</p>
        </ManagementSurface>
        <ManagementSurface>
          <p className="text-[10px] font-semibold tracking-[0.14em] text-[var(--mg-muted)] uppercase">
            Customer hours
          </p>
          <p className="mt-2 font-display text-2xl font-semibold text-[var(--mg-ink)]">28h package</p>
          <p className="mt-1 text-sm text-[var(--mg-muted)]">Prepaid hours never expire</p>
        </ManagementSurface>
      </div>

      <ManagementSurface className="mt-4">
        <p className="text-[10px] font-semibold tracking-[0.14em] text-[var(--mg-muted)] uppercase">
          Guide compensation
        </p>
        <table className="mt-3 w-full text-left text-sm">
          <thead className="text-[var(--mg-muted)]">
            <tr>
              <th className="py-2 font-medium">Guide</th>
              <th className="py-2 font-medium">Study Hall</th>
              <th className="py-2 font-medium">Amount</th>
              <th className="py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="text-[var(--mg-ink)]">
            <tr className="border-t border-[#ece6d8]">
              <td className="py-2.5">Sarah M.</td>
              <td>Jordan · Fri 6:30 PM</td>
              <td>$12.00</td>
              <td>Outstanding</td>
            </tr>
            <tr className="border-t border-[#ece6d8]">
              <td className="py-2.5">James O.</td>
              <td>Maya · Thu 5:00 PM</td>
              <td>$12.00</td>
              <td>Paid</td>
            </tr>
            <tr className="border-t border-[#ece6d8]">
              <td className="py-2.5">Grace K.</td>
              <td>Noah · Wed 7:00 PM</td>
              <td>$24.00</td>
              <td>Paid</td>
            </tr>
          </tbody>
        </table>
      </ManagementSurface>
    </ManagementPage>
  );
}
