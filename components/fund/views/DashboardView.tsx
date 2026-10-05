"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowDownToLine, ArrowLeftRight, ArrowRight, BookOpen, Briefcase, Eye, UserPlus } from "lucide-react";
import { errorMessage, type Dashboard, type JoinRequestDto } from "@/components/fund/api";
import { BarList, LineChart, NotEnoughData, PairedBars, SplitBar, formatInr, monthLabel } from "@/components/fund/charts";
import { TextAreaField } from "@/components/fund/forms";
import { useNotice } from "@/components/fund/notices";
import { FormDialog } from "@/components/fund/overlays";
import { resourceState } from "@/components/fund/common";
import { DateDisplay, MoneyDisplay, PercentDisplay, QualityBadge, QuantityDisplay, StatusBadge } from "@/components/fund/display";
import { formatXirr, humanize } from "@/components/fund/format";
import { poolBase, recordHref } from "@/components/fund/nav";
import { EmptyState, FinancialMetric, LoadingSkeleton, MetricCard, MetricsSkeleton, PageHeader, SectionCard, btnPrimary, btnSecondary } from "@/components/fund/parts";
import { useCan, useFund } from "@/components/fund/session";
import { DataTable } from "@/components/fund/table";
import { usePoolMutation, usePoolResource } from "@/components/fund/useResource";
import { AuditTrail } from "@/components/fund/workflow";
import { NavStatusCard } from "@/components/fund/views/NavStatusCard";
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

/** A VIEWER's way in: ask to become a MEMBER, with an optional note. */
function JoinBanner() {
  const res = usePoolResource<{ joinRequests: JoinRequestDto[] }>("join-requests");
  const { run, pending } = usePoolMutation();
  const { notify } = useNotice();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const latest = res.data?.joinRequests[0] ?? null;
  const waiting = latest?.status === "PENDING";

  return (
    <section aria-label="Membership" className="flex flex-col gap-3 rounded-xl border border-[var(--qf-brass)]/40 bg-[var(--qf-brass)]/8 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
      <div className="flex gap-3">
        <Eye size={18} className="mt-0.5 shrink-0 text-[var(--qf-brass-dark)]" aria-hidden="true" />
        <div>
          <p className="font-display text-[16px] font-semibold text-[var(--qf-ink)]">You are viewing this pool</p>
          <p className="mt-0.5 text-[13.5px] text-[var(--qf-ink-soft)]">
            {waiting
              ? "Your request to join as a member is waiting for review."
              : latest?.status === "REJECTED"
                ? `Your last request was declined${latest.reviewReason ? `: “${latest.reviewReason}”` : "."} You can ask again.`
                : "Viewers can see the pool's figures but cannot contribute. Ask an admin to make you a member."}
          </p>
        </div>
      </div>
      {res.data && (
        waiting ? (
          <button
            type="button"
            className={btnSecondary}
            disabled={pending}
            onClick={async () => {
              try {
                await run(`join-requests/${latest.id}`, { action: "withdraw" });
                notify("success", "Request withdrawn.");
                res.reload();
              } catch (err) {
                notify("error", errorMessage(err));
              }
            }}
          >
            Withdraw request
          </button>
        ) : (
          <button type="button" className={btnPrimary} onClick={() => setOpen(true)}>
            <UserPlus size={15} aria-hidden="true" /> Request to join as member
          </button>
        )
      )}
      <FormDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Request to join as a member"
        description="An admin or manager reviews it. As a member you can contribute, withdraw and take part in discussions."
        submitLabel="Send request"
        pending={pending}
        error={error}
        onSubmit={async () => {
          setError(null);
          try {
            await run("join-requests", { note: note.trim() || undefined });
            notify("success", "Request sent. You'll see the decision here.");
            setOpen(false);
            setNote("");
            res.reload();
          } catch (err) {
            setError(errorMessage(err));
          }
        }}
      >
        <TextAreaField label="Note for the admin (optional)" value={note} onChange={setNote} maxLength={1000} rows={4} />
      </FormDialog>
    </section>
  );
}

function ChartCard({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <SectionCard title={title} description={description}>
      {children}
    </SectionCard>
  );
}

function Charts({ d }: { d: Dashboard }) {
  const c = d.charts;
  if (!c) return null;
  const navPoints = c.nav.map((n) => ({ x: n.date, y: n.nav }));
  const valuePoints = c.nav.map((n) => ({ x: n.date, y: n.fundValue }));
  const delivery = d.holdings.rows.filter((r) => r.direction === "LONG");
  const totalCost = delivery.reduce((sum, r) => sum + Number(r.costBasis), 0);
  const sorted = [...delivery].sort((a, b) => Number(b.costBasis) - Number(a.costBasis));
  const top = sorted.slice(0, 7);
  const rest = sorted.slice(7).reduce((sum, r) => sum + Number(r.costBasis), 0);
  const allocation = [
    ...top.map((r) => ({
      label: `${instrumentLabel(r)}${r.product !== "EQUITY_DELIVERY" ? ` · ${PRODUCT_LABEL[r.product]}` : ""}`,
      value: Number(r.costBasis),
      display: formatInr(r.costBasis),
      note: totalCost > 0 ? `${((Number(r.costBasis) / totalCost) * 100).toFixed(1)}%` : undefined,
    })),
    ...(rest > 0 ? [{ label: `Other (${sorted.length - 7})`, value: rest, display: formatInr(rest), note: `${((rest / totalCost) * 100).toFixed(1)}%` }] : []),
  ];
  const latest = c.nav[c.nav.length - 1];
  const cashNow = Number(d.ledger.cash);
  const investedNow = latest ? Number(latest.holdingsValue) : 0;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <ChartCard title="NAV per unit" description="Official end-of-day NAV.">
        {navPoints.length >= 2 ? (
          <LineChart points={navPoints} caption="Official NAV per unit over time" valueLabel="NAV" format={(v) => `₹${Number(v).toFixed(4)}`} axisFormat={(v) => Number(v).toFixed(2)} />
        ) : (
          <NotEnoughData>The chart appears once at least two official NAVs have been struck.{navPoints.length === 1 ? ` First NAV: ₹${navPoints[0].y}.` : ""}</NotEnoughData>
        )}
      </ChartCard>
      <ChartCard title="Pool value" description="Cash plus holdings at each official NAV.">
        {valuePoints.length >= 2 ? (
          <LineChart points={valuePoints} caption="Pool value at each official NAV" valueLabel="Pool value" format={(v) => formatInr(v)} axisFormat={(v) => formatInr(v, true)} />
        ) : (
          <NotEnoughData>Needs at least two official NAVs.</NotEnoughData>
        )}
      </ChartCard>
      <ChartCard title="Money in and out" description="Finalized contributions and withdrawals, last 12 months.">
        {c.flows.length > 0 ? (
          <PairedBars
            rows={c.flows.map((f) => ({ label: monthLabel(f.month), values: [f.contributions, f.withdrawals] }))}
            series={[
              { label: "Contributions", color: "var(--qf-chart-1)" },
              { label: "Withdrawals", color: "var(--qf-chart-2)" },
            ]}
            caption="Contributions and withdrawals by month"
            format={(v) => formatInr(v)}
          />
        ) : (
          <NotEnoughData>No contributions or withdrawals have been finalized in the last 12 months.</NotEnoughData>
        )}
      </ChartCard>
      <div className="grid gap-6">
        <ChartCard title="Cash and investments" description={latest ? `Cash now; holdings at the official NAV of ${latest.date}.` : "Cash now."}>
          {cashNow > 0 || investedNow > 0 ? (
            <SplitBar
              caption="Cash versus invested value"
              parts={[
                { label: "Invested", value: Math.max(0, investedNow), display: formatInr(investedNow) },
                { label: "Cash", value: Math.max(0, cashNow), display: formatInr(cashNow) },
              ]}
            />
          ) : (
            <NotEnoughData>Nothing in the pool yet.</NotEnoughData>
          )}
        </ChartCard>
        <ChartCard title="P&L" description="Realized is locked in; unrealized is at the latest recorded prices.">
          <dl className="grid grid-cols-3 gap-3">
            {[
              { k: "Realized", v: d.holdings.realizedPnl },
              { k: "Unrealized", v: d.holdings.unrealizedPnl },
              { k: "Total", v: d.totalPnl },
            ].map((x) => (
              <div key={x.k}>
                <dt className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--qf-ink-soft)]">{x.k}</dt>
                <dd className="mt-1 font-display text-[17px] font-semibold">
                  <MoneyDisplay value={x.v} signed />
                </dd>
              </div>
            ))}
          </dl>
        </ChartCard>
      </div>
      <ChartCard title="Holdings mix" description="Open long positions at cost. A large single share means concentration.">
        {allocation.length > 0 ? <BarList rows={allocation} caption="Open positions by cost" /> : <NotEnoughData>No open positions yet.</NotEnoughData>}
      </ChartCard>
      <ChartCard title="Trading activity" description="Executed trade value by month (quantity × price).">
        {c.trading.length > 0 ? (
          <PairedBars
            rows={c.trading.map((t) => ({ label: monthLabel(t.month), values: [t.buyValue, t.sellValue] }))}
            series={[
              { label: "Bought", color: "var(--qf-chart-1)" },
              { label: "Sold", color: "var(--qf-chart-2)" },
            ]}
            caption="Bought and sold value by month"
            format={(v) => formatInr(v)}
          />
        ) : (
          <NotEnoughData>No trades executed in the last 12 months.</NotEnoughData>
        )}
      </ChartCard>
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
  const asOf = d?.officialNav ? `As of the official NAV of ${d.officialNav.asOfDate}.` : "No official NAV has been struck yet.";

  return (
    <>
      <PageHeader
        eyebrow="Dashboard"
        title={poolName}
        description={d ? asOf : undefined}
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
          <MetricsSkeleton />
          <SectionCard flush>
            <LoadingSkeleton label="Loading the dashboard" />
          </SectionCard>
        </div>
      ) : state ? (
        <SectionCard flush>{state}</SectionCard>
      ) : !d ? null : (
        <div className="space-y-6">
          {can("members:request_join") && <JoinBanner />}

          <NavStatusCard />

          {((d.pending.approvals ?? 0) > 0 || (d.pending.joinRequests ?? 0) > 0) && (
            <Link
              href={`${base}/approvals`}
              className="flex items-center justify-between gap-3 rounded-xl border border-[var(--qf-brass)]/50 bg-[var(--qf-brass)]/10 px-4 py-3 text-[14px] transition-colors hover:bg-[var(--qf-brass)]/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--qf-brass)]"
            >
              <span>
                <span className="font-semibold text-[var(--qf-ink)]">
                  {(d.pending.approvals ?? 0) + (d.pending.joinRequests ?? 0)} waiting for approval
                </span>
                <span className="text-[var(--qf-ink-soft)]">
                  {" "}
                  · {d.pending.approvals ?? 0} change request{d.pending.approvals === 1 ? "" : "s"}, {d.pending.joinRequests ?? 0} join request
                  {d.pending.joinRequests === 1 ? "" : "s"}
                </span>
              </span>
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
          )}

          <section aria-label="Pool value" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricCard emphasis label="NAV per unit" hint={d.officialNav ? (d.navChange?.percent ? undefined : `Official, ${d.officialNav.asOfDate}`) : "Starts at ₹10.0000"}>
              {d.officialNav ? <MoneyDisplay value={d.officialNav.nav} dp={4} /> : <span className="text-[var(--qf-ink-soft)]">Not struck</span>}
              {d.navChange?.percent && (
                <span className="mt-1 block text-[13px] font-medium">
                  <PercentDisplay value={d.navChange.percent} signed /> <span className="text-[var(--qf-ink-soft)]">since {d.navChange.previousDate}</span>
                </span>
              )}
            </MetricCard>
            <FinancialMetric emphasis label="Pool value" value={d.officialNav?.fundValue ?? null} hint="Cash + holdings, official" />
            <FinancialMetric label="Total contributions" value={d.totals.contributions} hint={`Withdrawn: ${formatInr(d.totals.withdrawals)}`} />
            <FinancialMetric label="Cash" value={d.ledger.cash} hint="Ledger balance now" />
          </section>

          <section aria-label="Performance and activity" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <FinancialMetric label="Invested value" value={d.officialNav?.holdingsValue ?? null} hint="Holdings at the official NAV" />
            <FinancialMetric label="Total P&L" value={d.totalPnl} signed hint={d.totalPnl === null ? "Some prices are missing" : "Realized + unrealized"} />
            <FinancialMetric label="Members" value={d.memberCount} kind="count" />
            <FinancialMetric label="Open positions" value={d.holdings.rows.length} kind="count" />
          </section>

          {d.indicativeFundValue === null && d.holdings.rows.length > 0 && (
            <p className="rounded-lg border border-[var(--qf-brass)]/40 bg-[var(--qf-brass)]/10 px-3.5 py-2.5 text-[13px] text-[var(--qf-ink)]">
              {d.holdings.unpriced} position{d.holdings.unpriced === 1 ? " has" : "s have"} no recorded price, so unrealized and total P&L are not shown.
              Official figures are unaffected.
            </p>
          )}

          <Charts d={d} />

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <SectionCard title="My position" description="Informational. XIRR shows N/A when it cannot be solved.">
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

            <SectionCard title="In progress" description="Requests you can see that are not finished yet.">
              <ul className="grid gap-2">
                <Waiting href={`${base}/contributions`} count={d.pending.contributions} label="Contributions in progress" />
                <Waiting href={`${base}/withdrawals`} count={d.pending.withdrawals} label="Withdrawals in progress" />
                {d.pending.draftTrades !== null && <Waiting href={`${base}/trades?status=DRAFT`} count={d.pending.draftTrades} label="Draft trades" />}
                {d.pending.expenses !== null && <Waiting href={`${base}/expenses`} count={d.pending.expenses} label="Expenses awaiting approval" />}
                {d.pending.approvals !== null && <Waiting href={`${base}/approvals`} count={d.pending.approvals} label="Requests awaiting an admin" />}
              </ul>
            </SectionCard>
          </div>

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
                  { key: "x", header: "Exposure", align: "right", hideOnMobile: true, cell: (r) => <MoneyDisplay value={r.entryNotional} /> },
                  {
                    key: "p",
                    header: "Recorded price",
                    align: "right",
                    cell: (r) =>
                      r.price === null ? (
                        <span className="whitespace-nowrap text-[12.5px] text-[var(--qf-ink-soft)]">Not priced yet</span>
                      ) : (
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
                    { key: "id", header: "Trade", primary: true, cell: (r) => r.symbol },
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
                    { key: "m", header: "Member", primary: true, cell: (r) => r.memberName },
                    { key: "a", header: "Amount", align: "right", cell: (r) => <MoneyDisplay value={r.amount} /> },
                    { key: "s", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
                  ]}
                />
              )}
            </SectionCard>
          </div>

          {can("audit:view") && d.recentActivity && (
            <SectionCard title="Pool activity" actions={<ViewAll href={`${base}/audit`} label="Audit log" />} flush>
              <AuditTrail items={d.recentActivity} />
            </SectionCard>
          )}

          <Link
            href={`${base}/guide`}
            className="group flex items-center justify-between gap-3 rounded-xl border border-[var(--qf-line)] px-4 py-3.5 transition-colors hover:border-[var(--qf-brass)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--qf-brass)]"
          >
            <span className="flex items-center gap-3">
              <BookOpen size={18} className="text-[var(--qf-brass-dark)]" aria-hidden="true" />
              <span>
                <span className="block font-semibold text-[var(--qf-ink)]">Understand how the pool works</span>
                <span className="block text-[13px] text-[var(--qf-ink-soft)]">NAV, units, roles and approvals in the Pool Guide.</span>
              </span>
            </span>
            <ArrowRight size={15} className="text-[var(--qf-ink-soft)] transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </Link>
        </div>
      )}
    </>
  );
}
