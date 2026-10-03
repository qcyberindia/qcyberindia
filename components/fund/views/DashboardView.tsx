"use client";

import Link from "next/link";
import { ArrowDownToLine, ArrowLeftRight, ArrowRight, Briefcase } from "lucide-react";
import type { Dashboard } from "@/components/fund/api";
import { resourceState } from "@/components/fund/common";
import { DateDisplay, MoneyDisplay, PercentDisplay, QualityBadge, QuantityDisplay, StatusBadge } from "@/components/fund/display";
import { formatXirr, humanize } from "@/components/fund/format";
import { NavChart } from "@/components/fund/NavChart";
import { poolBase, recordHref } from "@/components/fund/nav";
import { EmptyState, FinancialMetric, LoadingSkeleton, MetricCard, MetricsSkeleton, PageHeader, SectionCard } from "@/components/fund/parts";
import { useCan, useFund } from "@/components/fund/session";
import { DataTable } from "@/components/fund/table";
import { usePoolResource } from "@/components/fund/useResource";
import { AuditTrail } from "@/components/fund/workflow";
import { SideLabel, PRODUCT_LABEL, instrumentLabel } from "@/components/fund/views/shared";

function ViewAll({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 text-[13px] font-semibold text-[var(--qf-brass-dark)] hover:underline underline-offset-4">
      {label} <ArrowRight size={13} aria-hidden="true" />
    </Link>
  );
}

function Waiting({ href, count, label }: { href: string; count: number; label: string }) {
  return (
    <li>
      <Link
        href={href}
        className="group flex min-h-12 items-center justify-between gap-3 rounded-lg border border-[var(--qf-line)] px-3.5 py-2.5 transition-colors hover:border-[var(--qf-brass)] hover:bg-[var(--qf-cream-1)]/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--qf-brass)]"
      >
        <span className="text-[13.5px] text-[var(--qf-ink)]">{label}</span>
        <span className="flex items-center gap-2">
          <span
            className={`min-w-7 rounded-full px-2 py-0.5 text-center text-[12.5px] font-semibold tabular-nums ${
              count > 0 ? "bg-[var(--qf-brass)]/15 text-[var(--qf-brass-dark)]" : "bg-[var(--qf-cream-1)] text-[var(--qf-ink-soft)]"
            }`}
          >
            {count}
          </span>
          <ArrowRight size={14} className="text-[var(--qf-ink-soft)] transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
        </span>
      </Link>
    </li>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[var(--qf-ink-soft)]">{label}</dt>
      <dd className="mt-1 font-display text-[17px] font-semibold text-[var(--qf-ink)]">{children}</dd>
    </div>
  );
}

export function DashboardView() {
  const { poolId, poolName, poolStatus, role } = useFund();
  const can = useCan();
  const res = usePoolResource<Dashboard>("dashboard");
  const state = res.loading ? null : resourceState(res, "the dashboard");
  const d = res.data;
  const base = poolBase(poolId);

  return (
    <>
      <PageHeader
        eyebrow="Private pool"
        title={poolName}
        description="Official figures are as of the latest end-of-day NAV struck by the pool administrator."
        actions={
          <>
            {poolStatus !== "active" && <StatusBadge status={poolStatus} />}
            <StatusBadge status={role} label={humanize(role)} />
          </>
        }
      />
      {res.loading ? (
        <div className="space-y-6">
          <MetricsSkeleton />
          <SectionCard flush>
            <LoadingSkeleton label="Loading the dashboard" />
          </SectionCard>
        </div>
      ) : state ? (
        <SectionCard flush>{state}</SectionCard>
      ) : !d ? null : (
        <div className="space-y-6">
          <section aria-label="Pool value" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricCard
              emphasis
              label="NAV per unit"
              hint={d.officialNav ? `Official, ${d.officialNav.asOfDate}` : "No official NAV yet (initial ₹10.0000)"}
            >
              {d.officialNav ? <MoneyDisplay value={d.officialNav.nav} dp={4} /> : <span className="text-[var(--qf-ink-soft)]">Not struck</span>}
            </MetricCard>
            <FinancialMetric emphasis label="Pool value (official)" value={d.officialNav?.fundValue ?? null} hint="Cash + holdings at the official NAV" />
            <FinancialMetric label="Cash (ledger, now)" value={d.ledger.cash} />
            <FinancialMetric label="Holdings value (official)" value={d.officialNav?.holdingsValue ?? null} />
          </section>

          <section aria-label="Performance" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricCard label="Change since previous NAV">
              {d.navChange ? <PercentDisplay value={d.navChange.percent} signed /> : <span className="text-[var(--qf-ink-soft)]">&mdash;</span>}
            </MetricCard>
            <FinancialMetric label="Unrealized P&L" value={d.holdings.unrealizedPnl} signed hint="At latest available prices" />
            <FinancialMetric label="Realized P&L" value={d.holdings.realizedPnl} signed />
            <FinancialMetric label="Members" value={d.memberCount} kind="count" />
          </section>

          {d.indicativeFundValue === null && d.holdings.rows.length > 0 && (
            <p className="rounded-lg border border-[var(--qf-brass)]/40 bg-[var(--qf-brass)]/10 px-3.5 py-2.5 text-[13px] text-[var(--qf-ink)]">
              {d.holdings.unpriced} holding{d.holdings.unpriced === 1 ? " has" : "s have"} no available price, so an indicative current value is
              not shown. Official figures are unaffected.
            </p>
          )}

          <div className={`grid gap-6 ${can("reports:view") ? "lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]" : ""}`}>
            {can("reports:view") && (
              <SectionCard title="NAV history" description="Official end-of-day NAV per unit." actions={<ViewAll href={`${base}/reports`} label="Reports" />} flush>
                <NavChart />
              </SectionCard>
            )}
            <SectionCard title="My position" description="Informational. XIRR is shown as N/A when it cannot be solved.">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-5">
                <Fact label="Value at official NAV">
                  <MoneyDisplay value={d.me.currentValue} />
                </Fact>
                <Fact label="Contributed">
                  <MoneyDisplay value={d.me.invested} />
                </Fact>
                <Fact label="Units">
                  <QuantityDisplay value={d.me.units} />
                </Fact>
                <Fact label="Ownership">
                  <PercentDisplay value={d.me.ownershipPercent} />
                </Fact>
                <Fact label="XIRR (informational)">
                  <span className="tabular-nums">{formatXirr(d.me.xirr)}</span>
                </Fact>
              </dl>
            </SectionCard>
          </div>

          <SectionCard title="Waiting on the pool" description="Requests in progress you can see.">
            <ul className="grid gap-2 sm:grid-cols-2">
              <Waiting href={`${base}/contributions`} count={d.pending.contributions} label="Contributions in progress" />
              <Waiting href={`${base}/withdrawals`} count={d.pending.withdrawals} label="Withdrawals in progress" />
              {d.pending.draftTrades !== null && <Waiting href={`${base}/trades?status=DRAFT`} count={d.pending.draftTrades} label="Draft trades" />}
              {d.pending.expenses !== null && <Waiting href={`${base}/expenses`} count={d.pending.expenses} label="Expenses awaiting approval" />}
            </ul>
            {d.market && (
              <p className="mt-4 flex items-center gap-2 text-[12.5px] text-[var(--qf-ink-soft)]">
                <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${d.market.state === "OPEN" ? "bg-[var(--qf-up)]" : "bg-[var(--qf-ink-soft)]"}`} />
                NSE/BSE session: {d.market.state === "OPEN" ? "open" : "closed"} ({d.market.reason}). Based on the trading calendar, not a live
                exchange feed.
              </p>
            )}
          </SectionCard>

          <SectionCard title="Open positions" actions={<ViewAll href={`${base}/holdings`} label="All positions" />} flush>
            {d.holdings.rows.length === 0 ? (
              <EmptyState icon={Briefcase} title="No open positions" description="Positions appear once a trade is executed." />
            ) : (
              <DataTable
                caption="Open positions"
                rows={d.holdings.rows.slice(0, 6)}
                rowKey={(r) => `${r.instrumentId}:${r.product}`}
                columns={[
                  { key: "s", header: "Instrument", primary: true, cell: (r) => `${instrumentLabel(r)} · ${PRODUCT_LABEL[r.product]}${r.direction === "SHORT" ? " · Short" : ""}` },
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
                <EmptyState icon={ArrowLeftRight} title="No trades yet" description="Executed and draft trades will be listed here." />
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
                <EmptyState icon={ArrowDownToLine} title="No contributions yet" description="Money members put into the pool shows up here." />
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
