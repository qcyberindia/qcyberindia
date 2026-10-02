"use client";

import Link from "next/link";
import { endpoints, itemOf, type DashboardDto } from "@/components/fund/api";
import { DateDisplay, MoneyDisplay, PercentDisplay, StatusBadge } from "@/components/fund/display";
import { useFundResource } from "@/components/fund/useResource";
import { useCan, useFund } from "@/components/fund/session";
import { EmptyState, FinancialMetric, PageHeader, SectionCard } from "@/components/fund/parts";
import { resourceState } from "@/components/fund/common";
import { DataTable } from "@/components/fund/table";
import { ActivityTimeline } from "@/components/fund/timeline";
import { DetailGrid } from "@/components/fund/workflow";
import { FUND_BASE, recordHref } from "@/components/fund/nav";
import {
  contributionColumns,
  holdingColumns,
  tradeColumns,
  withdrawalColumns,
} from "@/components/fund/views/columns";

function ViewAll({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="text-[13px] font-semibold text-[var(--qf-brass-dark)] underline underline-offset-2">
      {label}
    </Link>
  );
}

function Recent({ children, empty }: { children: React.ReactNode; empty: string }) {
  return children || <EmptyState title={empty} />;
}

export function DashboardView() {
  const { fundName } = useFund();
  const can = useCan();
  const res = useFundResource<DashboardDto | null>(endpoints.dashboard, {}, (json) => itemOf<DashboardDto>(json));
  const state = resourceState(res, "dashboard");
  const raw = res.data;
  // The response shape is an assumed contract: tolerate omitted collections instead of crashing.
  const d = raw
    ? {
        ...raw,
        allocation: raw.allocation ?? [],
        holdings: raw.holdings ?? [],
        recentTrades: raw.recentTrades ?? [],
        recentContributions: raw.recentContributions ?? [],
        recentWithdrawals: raw.recentWithdrawals ?? [],
        recentActivity: raw.recentActivity ?? [],
        pendingApprovals: raw.pendingApprovals ?? { contributions: 0, withdrawals: 0 },
      }
    : null;

  return (
    <>
      <PageHeader eyebrow="QFinera Fund" title="Dashboard" description={`An overview of ${fundName}.`} />

      {state ? (
        <SectionCard flush>{state}</SectionCard>
      ) : !d ? (
        <SectionCard>
          <EmptyState title="No fund data yet" description="Figures appear here once the fund has contributions and a NAV." />
        </SectionCard>
      ) : (
        <div className="space-y-6">
          <section aria-label="Key figures" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <FinancialMetric label="Fund value" value={d.fundValue} />
            <FinancialMetric label="NAV / unit" value={d.navPerUnit} kind="nav" />
            <FinancialMetric label="Available cash" value={d.cash} />
            <FinancialMetric label="Invested value" value={d.investedValue} />
            <FinancialMetric label="Total units" value={d.totalUnits} kind="quantity" />
            <FinancialMetric label="Members" value={d.memberCount} kind="count" />
            <FinancialMetric label="Daily P&L" value={d.dailyPnl} signed />
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <SectionCard title="Latest NAV" description="The most recent NAV snapshot.">
              {d.latestNav ? (
                <DetailGrid
                  items={[
                    { label: "As of", value: <DateDisplay value={d.latestNav.as_of_date} /> },
                    { label: "NAV / unit", value: <MoneyDisplay value={d.latestNav.nav} dp={4} /> },
                    {
                      label: "Status",
                      value: <StatusBadge status={d.latestNav.is_official ? "FINALIZED" : "PENDING"} label={d.latestNav.is_official ? "Official" : "Not official yet"} />,
                    },
                    { label: "Fund value", value: <MoneyDisplay value={d.latestNav.fund_value} /> },
                    { label: "Cash", value: <MoneyDisplay value={d.latestNav.cash} /> },
                    { label: "Holdings value", value: <MoneyDisplay value={d.latestNav.holdings_value} /> },
                  ]}
                />
              ) : (
                <EmptyState title="No NAV recorded yet" description="Contributions are allocated units only after an official NAV exists." />
              )}
            </SectionCard>

            <SectionCard title="Allocation" description="How the fund value is split.">
              {d.allocation.length === 0 ? (
                <EmptyState title="No allocation to show" />
              ) : (
                <ul className="divide-y divide-[var(--qf-line)]">
                  {d.allocation.map((a) => (
                    <li key={a.label} className="flex items-center justify-between gap-3 py-2.5 text-[14px]">
                      <span className="min-w-0 truncate text-[var(--qf-ink)]">{a.label}</span>
                      <span className="flex shrink-0 items-baseline gap-3">
                        <MoneyDisplay value={a.value} />
                        <PercentDisplay value={a.percent} className="w-16 text-right text-[var(--qf-ink-soft)]" />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          </div>

          {(can("contributions:approve") || can("withdrawals:approve")) && (
            <SectionCard title="Pending approvals" description="Requests waiting for an administrator.">
              <ul className="flex flex-col gap-2 text-[14px] sm:flex-row sm:gap-8">
                <li>
                  <Link className="underline underline-offset-2" href={`${FUND_BASE}/contributions?status=PENDING`}>
                    {d.pendingApprovals.contributions} contribution{d.pendingApprovals.contributions === 1 ? "" : "s"} to approve
                  </Link>
                </li>
                <li>
                  <Link className="underline underline-offset-2" href={`${FUND_BASE}/withdrawals?status=REQUESTED`}>
                    {d.pendingApprovals.withdrawals} withdrawal{d.pendingApprovals.withdrawals === 1 ? "" : "s"} to approve
                  </Link>
                </li>
              </ul>
            </SectionCard>
          )}

          <SectionCard title="Holdings" actions={<ViewAll href={`${FUND_BASE}/holdings`} label="View all holdings" />} flush>
            <Recent empty="No holdings yet">
              {d.holdings.length > 0 && (
                <DataTable columns={holdingColumns} rows={d.holdings.slice(0, 6)} rowKey={(r) => r.instrument_id} caption="Largest holdings" />
              )}
            </Recent>
          </SectionCard>

          <div className="grid gap-6 xl:grid-cols-2">
            <SectionCard title="Recent trades" actions={<ViewAll href={`${FUND_BASE}/trades`} label="All trades" />} flush>
              <Recent empty="No trades yet">
                {d.recentTrades.length > 0 && (
                  <DataTable columns={tradeColumns(false)} rows={d.recentTrades} rowKey={(r) => r.id} rowHref={(r) => recordHref("trades", r.id)} caption="Recent trades" />
                )}
              </Recent>
            </SectionCard>
            <SectionCard title="Recent contributions" actions={<ViewAll href={`${FUND_BASE}/contributions`} label="All contributions" />} flush>
              <Recent empty="No contributions yet">
                {d.recentContributions.length > 0 && (
                  <DataTable columns={contributionColumns(false)} rows={d.recentContributions} rowKey={(r) => r.id} rowHref={(r) => recordHref("contributions", r.id)} caption="Recent contributions" />
                )}
              </Recent>
            </SectionCard>
            <SectionCard title="Recent withdrawals" actions={<ViewAll href={`${FUND_BASE}/withdrawals`} label="All withdrawals" />} flush>
              <Recent empty="No withdrawals yet">
                {d.recentWithdrawals.length > 0 && (
                  <DataTable columns={withdrawalColumns(false)} rows={d.recentWithdrawals} rowKey={(r) => r.id} rowHref={(r) => recordHref("withdrawals", r.id)} caption="Recent withdrawals" />
                )}
              </Recent>
            </SectionCard>
            <SectionCard title="Recent activity" flush>
              {d.recentActivity.length === 0 ? <EmptyState title="No activity yet" /> : <ActivityTimeline items={d.recentActivity} />}
            </SectionCard>
          </div>
        </div>
      )}
    </>
  );
}
