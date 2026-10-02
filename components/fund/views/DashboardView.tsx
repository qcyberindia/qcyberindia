"use client";

import Link from "next/link";
import type { Dashboard } from "@/components/fund/api";
import { resourceState } from "@/components/fund/common";
import { DateDisplay, MoneyDisplay, PercentDisplay, QualityBadge, QuantityDisplay, StatusBadge } from "@/components/fund/display";
import { formatXirr } from "@/components/fund/format";
import { poolBase, recordHref } from "@/components/fund/nav";
import { EmptyState, FinancialMetric, MetricCard, PageHeader, SectionCard } from "@/components/fund/parts";
import { useCan, useFund } from "@/components/fund/session";
import { DataTable } from "@/components/fund/table";
import { usePoolResource } from "@/components/fund/useResource";
import { AuditTrail } from "@/components/fund/workflow";
import { SideLabel } from "@/components/fund/views/shared";

function ViewAll({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="text-[13px] font-semibold text-[var(--qf-brass-dark)] underline underline-offset-2">
      {label}
    </Link>
  );
}

export function DashboardView() {
  const { poolId, poolName } = useFund();
  const can = useCan();
  const res = usePoolResource<Dashboard>("dashboard");
  const state = resourceState(res, "the dashboard");
  const d = res.data;
  const base = poolBase(poolId);

  return (
    <>
      <PageHeader eyebrow="Private pool" title={poolName} description="Official figures are as of the latest end-of-day NAV struck by the pool administrator." />
      {state ? (
        <SectionCard flush>{state}</SectionCard>
      ) : !d ? null : (
        <div className="space-y-6">
          <section aria-label="Pool figures" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricCard
              label="NAV per unit"
              hint={d.officialNav ? `Official, ${d.officialNav.asOfDate}` : "No official NAV yet (initial ₹10.0000)"}
            >
              {d.officialNav ? <MoneyDisplay value={d.officialNav.nav} dp={4} /> : <span className="text-[var(--qf-ink-soft)]">Not struck</span>}
            </MetricCard>
            <FinancialMetric label="Pool value (official)" value={d.officialNav?.fundValue ?? null} hint="Cash + holdings at the official NAV" />
            <FinancialMetric label="Cash (ledger, now)" value={d.ledger.cash} />
            <FinancialMetric label="Holdings value (official)" value={d.officialNav?.holdingsValue ?? null} />
            <MetricCard label="Change since previous NAV">
              {d.navChange ? <PercentDisplay value={d.navChange.percent} signed /> : <span className="text-[var(--qf-ink-soft)]">&mdash;</span>}
            </MetricCard>
            <FinancialMetric label="Unrealized P&L" value={d.holdings.unrealizedPnl} signed hint="At latest available prices" />
            <FinancialMetric label="Realized P&L" value={d.holdings.realizedPnl} signed />
            <FinancialMetric label="Members" value={d.memberCount} kind="count" />
          </section>

          {d.indicativeFundValue === null && d.holdings.rows.length > 0 && (
            <p className="rounded-md border border-[var(--qf-brass)]/40 bg-[var(--qf-brass)]/10 px-3.5 py-2.5 text-[13px] text-[var(--qf-ink)]">
              {d.holdings.unpriced} holding{d.holdings.unpriced === 1 ? " has" : "s have"} no available price, so an indicative current value is
              not shown. Official figures are unaffected.
            </p>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            <SectionCard title="My position" description="Informational. XIRR is shown as N/A when it cannot be solved.">
              <dl className="grid grid-cols-2 gap-4 text-[14px]">
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-[var(--qf-ink-soft)]">Units</dt>
                  <dd className="mt-1">
                    <QuantityDisplay value={d.me.units} />
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-[var(--qf-ink-soft)]">Ownership</dt>
                  <dd className="mt-1">
                    <PercentDisplay value={d.me.ownershipPercent} />
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-[var(--qf-ink-soft)]">Value at official NAV</dt>
                  <dd className="mt-1">
                    <MoneyDisplay value={d.me.currentValue} />
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-[var(--qf-ink-soft)]">Contributed</dt>
                  <dd className="mt-1">
                    <MoneyDisplay value={d.me.invested} />
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-[var(--qf-ink-soft)]">XIRR (informational)</dt>
                  <dd className="mt-1 tabular-nums">{formatXirr(d.me.xirr)}</dd>
                </div>
              </dl>
            </SectionCard>

            <SectionCard title="Waiting on the pool" description="Requests in progress you can see.">
              <ul className="space-y-2 text-[14px]">
                <li>
                  <Link className="underline underline-offset-2" href={`${base}/contributions`}>
                    {d.pending.contributions} contribution{d.pending.contributions === 1 ? "" : "s"} in progress
                  </Link>
                </li>
                <li>
                  <Link className="underline underline-offset-2" href={`${base}/withdrawals`}>
                    {d.pending.withdrawals} withdrawal{d.pending.withdrawals === 1 ? "" : "s"} in progress
                  </Link>
                </li>
                {d.pending.draftTrades !== null && (
                  <li>
                    <Link className="underline underline-offset-2" href={`${base}/trades?status=DRAFT`}>
                      {d.pending.draftTrades} draft trade{d.pending.draftTrades === 1 ? "" : "s"}
                    </Link>
                  </li>
                )}
                {d.pending.expenses !== null && (
                  <li>
                    <Link className="underline underline-offset-2" href={`${base}/expenses`}>
                      {d.pending.expenses} expense{d.pending.expenses === 1 ? "" : "s"} awaiting approval
                    </Link>
                  </li>
                )}
              </ul>
              {d.market && (
                <p className="mt-4 text-[12.5px] text-[var(--qf-ink-soft)]">
                  NSE/BSE session: {d.market.state === "OPEN" ? "open" : "closed"} ({d.market.reason}). Based on the trading calendar, not a live
                  exchange feed.
                </p>
              )}
            </SectionCard>
          </div>

          <SectionCard title="Holdings" actions={<ViewAll href={`${base}/holdings`} label="All holdings" />} flush>
            {d.holdings.rows.length === 0 ? (
              <EmptyState title="No holdings yet" description="Holdings appear once a trade is executed." />
            ) : (
              <DataTable
                caption="Holdings"
                rows={d.holdings.rows.slice(0, 6)}
                rowKey={(r) => r.instrumentId}
                columns={[
                  { key: "s", header: "Instrument", primary: true, cell: (r) => `${r.symbol} · ${r.exchange}` },
                  { key: "q", header: "Quantity", align: "right", cell: (r) => <QuantityDisplay value={r.quantity} /> },
                  {
                    key: "p",
                    header: "Price",
                    align: "right",
                    cell: (r) => (
                      <span className="flex flex-col items-end gap-1">
                        <MoneyDisplay value={r.price} dp={4} />
                        <QualityBadge quality={r.priceQuality} stale={r.priceStale} />
                      </span>
                    ),
                  },
                  { key: "v", header: "Value", align: "right", cell: (r) => <MoneyDisplay value={r.marketValue} /> },
                  { key: "u", header: "Unrealized P&L", align: "right", cell: (r) => <MoneyDisplay value={r.unrealizedPnl} signed /> },
                ]}
              />
            )}
          </SectionCard>

          <div className="grid gap-6 xl:grid-cols-2">
            <SectionCard title="Recent trades" actions={<ViewAll href={`${base}/trades`} label="All trades" />} flush>
              {d.recentTrades.length === 0 ? (
                <EmptyState title="No trades yet" />
              ) : (
                <DataTable
                  caption="Recent trades"
                  rows={d.recentTrades}
                  rowKey={(r) => r.id}
                  rowHref={(r) => recordHref(poolId, "trades", r.id)}
                  columns={[
                    { key: "id", header: "Trade", primary: true, cell: (r) => `#${r.id} ${r.symbol}` },
                    { key: "side", header: "Side", cell: (r) => <SideLabel side={r.side} /> },
                    { key: "d", header: "Date", cell: (r) => <DateDisplay value={r.tradeDate} /> },
                    { key: "st", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
                  ]}
                />
              )}
            </SectionCard>
            <SectionCard title="Recent contributions" actions={<ViewAll href={`${base}/contributions`} label="All contributions" />} flush>
              {d.recentContributions.length === 0 ? (
                <EmptyState title="No contributions yet" />
              ) : (
                <DataTable
                  caption="Recent contributions"
                  rows={d.recentContributions}
                  rowKey={(r) => r.id}
                  rowHref={(r) => recordHref(poolId, "contributions", r.id)}
                  columns={[
                    { key: "id", header: "Contribution", primary: true, cell: (r) => `#${r.id}` },
                    { key: "m", header: "Member", cell: (r) => r.memberName },
                    { key: "a", header: "Amount", align: "right", cell: (r) => <MoneyDisplay value={r.amount} /> },
                    { key: "s", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
                  ]}
                />
              )}
            </SectionCard>
          </div>

          {can("audit:view") && d.recentActivity && (
            <SectionCard title="Recent activity" actions={<ViewAll href={`${base}/audit`} label="Audit log" />} flush>
              <AuditTrail items={d.recentActivity} />
            </SectionCard>
          )}
        </div>
      )}
    </>
  );
}
