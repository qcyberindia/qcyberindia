"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { errorMessage, type Daily, type Member, type PositionsReportDto, type NavSnapshot, type Statement, type StrikeResultDto } from "@/components/fund/api";
import { resourceState } from "@/components/fund/common";
import { DateDisplay, MoneyDisplay, QuantityDisplay, StatusBadge } from "@/components/fund/display";
import { TextField, inputClass } from "@/components/fund/forms";
import { formatXirr, humanize } from "@/components/fund/format";
import { useNotice } from "@/components/fund/notices";
import { Disclaimer, EmptyState, MetricCard, PageHeader, SectionCard, btnPrimary } from "@/components/fund/parts";
import { useCan, useFund } from "@/components/fund/session";
import { DataTable } from "@/components/fund/table";
import { usePoolMutation, usePoolResource } from "@/components/fund/useResource";
import { APPROVAL_SENT, ApprovalNotice, DetailGrid, isPendingApproval } from "@/components/fund/workflow";
import { DirectionLabel, PRODUCT_LABEL, SideLabel, instrumentLabel, todayIstInput } from "@/components/fund/views/shared";

type Tab = "daily" | "nav-history" | "statement" | "positions" | "tax";
const TABS: Array<{ key: Tab; label: string }> = [
  { key: "daily", label: "Daily report" },
  { key: "nav-history", label: "NAV history" },
  { key: "statement", label: "Member statement" },
  { key: "positions", label: "P&L and exposure" },
  { key: "tax", label: "Tax estimate" },
];

function SnapshotFigures({ s }: { s: NavSnapshot }) {
  return (
    <DetailGrid
      items={[
        { label: "NAV per unit", value: <MoneyDisplay value={s.nav} dp={4} /> },
        { label: "Pool value", value: <MoneyDisplay value={s.fundValue} /> },
        { label: "Cash", value: <MoneyDisplay value={s.cash} /> },
        { label: "Holdings value", value: <MoneyDisplay value={s.holdingsValue} /> },
        { label: "Units outstanding", value: <QuantityDisplay value={s.outstandingUnits} /> },
        { label: "Version", value: s.calculationVersion > 1 ? `${s.calculationVersion} (corrected: ${s.correctionReason ?? ""})` : "1" },
      ]}
    />
  );
}

function StrikePanel({ daily, onDone }: { daily: Daily; onDone: () => void }) {
  const { run, pending } = usePoolMutation();
  const { notify } = useNotice();
  const proposing = useFund().role === "MANAGER";
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<StrikeResultDto | null>(null);
  const p = daily.preview;
  if (!p) return null;
  const blocked = p.problems.length > 0 || !p.result;

  return (
    <SectionCard
      title={p.official ? "Correct the official NAV" : "Strike the official NAV"}
      description="Computed from the ledger and that day's recorded closing prices. Nothing is estimated."
    >
      {proposing && (
        <div className="mb-4">
          <ApprovalNotice />
        </div>
      )}
      {p.problems.length > 0 && (
        <ul role="alert" className="mb-4 list-disc space-y-1 rounded-md border border-[var(--qf-down)]/30 bg-[var(--qf-down)]/10 py-2 pl-7 pr-3 text-[13px] text-[var(--qf-ink)]">
          {p.problems.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      )}
      <DetailGrid
        items={[
          { label: "Computed NAV", value: p.result ? <MoneyDisplay value={p.result.nav} dp={4} /> : "Cannot be computed" },
          { label: "Pool value", value: <MoneyDisplay value={p.result?.fundValue ?? null} /> },
          { label: "Cash", value: <MoneyDisplay value={p.cash} /> },
          { label: "Holdings value", value: <MoneyDisplay value={p.result?.holdingsValue ?? null} /> },
          { label: "Units outstanding", value: <QuantityDisplay value={p.outstandingUnits} /> },
          { label: "Requests finalized at this NAV", value: `${p.dueOnDate.length}` },
        ]}
      />
      {p.overdue.length > 0 && (
        <p className="mt-3 text-[13px] text-[var(--qf-down)]">
          {p.overdue.length} request(s) are waiting for an earlier NAV date that was not struck ({[...new Set(p.overdue.map((o) => o.navDate))].join(", ")}). Strike
          those dates first.
        </p>
      )}
      {p.holdings.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <DataTable
            caption="Positions valued for this NAV"
            rows={p.holdings}
            rowKey={(r) => `${r.instrumentId}:${r.product}`}
            columns={[
              { key: "s", header: "Instrument", primary: true, cell: (r) => `${r.symbol} · ${r.exchange}` },
              { key: "pr", header: "Product", cell: (r) => `${PRODUCT_LABEL[r.product]}${r.direction === "SHORT" ? " · Short" : ""}` },
              { key: "q", header: "Quantity", align: "right", cell: (r) => <QuantityDisplay value={r.quantity} /> },
              { key: "p", header: "Closing price", align: "right", cell: (r) => (r.price ? <MoneyDisplay value={r.price} dp={4} /> : <span className="text-[var(--qf-down)]">Missing</span>) },
              { key: "v", header: "Value", align: "right", cell: (r) => <MoneyDisplay value={r.value} /> },
            ]}
          />
        </div>
      )}
      {p.requiresCorrection && (
        <fieldset className="mt-4 space-y-2 rounded-md border border-[var(--qf-line)] p-3">
          <legend className="px-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--qf-ink-soft)]">Correction</legend>
          <p className="text-[13px] text-[var(--qf-ink-soft)]">
            {p.official
              ? "An official NAV exists for this date. A correction keeps the old version in history and records the new one. It is refused if units were already allocated or redeemed at this NAV."
              : `This date is before the latest official NAV (${p.latestOfficialDate}). Striking it is a backdated correction.`}
          </p>
          <TextField label="Reason (at least 10 characters)" value={reason} onChange={setReason} maxLength={500} />
          <label className="flex items-start gap-2 text-[13px]">
            <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} className="mt-0.5 h-4 w-4" />I confirm this correction.
          </label>
        </fieldset>
      )}
      {error && (
        <p role="alert" className="mt-3 rounded-md border border-[var(--qf-down)]/30 bg-[var(--qf-down)]/10 px-3 py-2 text-[13px] text-[var(--qf-down)]">
          {error}
        </p>
      )}
      {result && (
        <div role="status" className="mt-3 rounded-md border border-[var(--qf-up)]/40 bg-[var(--qf-cream-1)] px-3 py-2 text-[13px]">
          NAV {result.snapshot.nav} recorded. Finalized {result.finalized.contributions.length} contribution(s) and {result.finalized.withdrawals.length} withdrawal(s).
          {result.blocked.length > 0 && (
            <ul className="mt-1 list-disc pl-5 text-[var(--qf-down)]">
              {result.blocked.map((b) => (
                <li key={`${b.kind}${b.id}`}>
                  {humanize(b.kind)} #{b.id} still waiting: {b.reason}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <button
        type="button"
        className={`${btnPrimary} mt-4`}
        disabled={pending || blocked || (p.requiresCorrection && (reason.trim().length < 10 || !confirm))}
        onClick={async () => {
          setError(null);
          setResult(null);
          try {
            const r = await run<StrikeResultDto | { pendingApproval: true }>("nav", {
              date: p.date,
              ...(p.requiresCorrection ? { correctionReason: reason.trim(), confirmCorrection: confirm } : {}),
            });
            if (isPendingApproval(r)) {
              notify("success", APPROVAL_SENT);
            } else {
              setResult(r as StrikeResultDto);
              notify("success", `Official NAV for ${p.date} recorded.`);
            }
            onDone();
          } catch (err) {
            setError(errorMessage(err));
          }
        }}
      >
        {pending && <Loader2 size={14} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
        {proposing ? "Send for approval" : p.official ? "Record corrected NAV" : "Strike official NAV"}
      </button>
    </SectionCard>
  );
}

function DailyTab() {
  const [date, setDate] = useState(todayIstInput());
  const res = usePoolResource<Daily>("reports", { type: "daily", date });
  const state = resourceState(res, "the daily report");
  const d = res.data;
  return (
    <div className="space-y-6">
      <div className="max-w-xs">
        <TextField label="Date" type="date" value={date} onChange={setDate} />
      </div>
      {state ? (
        <SectionCard flush>{state}</SectionCard>
      ) : !d ? null : (
        <>
          <SectionCard title={`Official NAV for ${d.date}`}>
            {d.official ? <SnapshotFigures s={d.official} /> : <p className="text-[14px] text-[var(--qf-ink-soft)]">No official NAV has been struck for this date.</p>}
          </SectionCard>
          <section aria-label="Flows" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricCard label="Contributions finalized" hint={`${d.contributions.count} request(s)`}>
              <MoneyDisplay value={d.contributions.total} />
            </MetricCard>
            <MetricCard label="Units issued">
              <QuantityDisplay value={d.contributions.units} />
            </MetricCard>
            <MetricCard label="Withdrawals paid (net)" hint={`${d.withdrawals.count} request(s)`}>
              <MoneyDisplay value={d.withdrawals.total} />
            </MetricCard>
            <MetricCard label="Expenses" hint={`${d.expenses.count} approved`}>
              <MoneyDisplay value={d.expenses.total} />
            </MetricCard>
          </section>
          <SectionCard title="Trades on this date" flush>
            {d.trades.length === 0 ? (
              <EmptyState title="No trades on this date" />
            ) : (
              <DataTable
                caption="Trades on this date"
                rows={d.trades}
                rowKey={(r) => r.id}
                columns={[
                  { key: "i", header: "Trade", primary: true, cell: (r) => `#${r.id} ${r.symbol} · ${r.exchange}` },
                  { key: "s", header: "Side", cell: (r) => <SideLabel side={r.side} /> },
                  { key: "q", header: "Quantity", align: "right", cell: (r) => <QuantityDisplay value={r.quantity} /> },
                  { key: "n", header: "Net value", align: "right", cell: (r) => <MoneyDisplay value={r.netValue} /> },
                  { key: "st", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
                ]}
              />
            )}
          </SectionCard>
          {d.contributions.rows && d.contributions.rows.length + (d.withdrawals.rows?.length ?? 0) > 0 && (
            <SectionCard title="Member flows" flush>
              <DataTable
                caption="Member flows on this date"
                rows={[
                  ...d.contributions.rows.map((r) => ({ ...r, kind: "Contribution" })),
                  ...(d.withdrawals.rows ?? []).map((r) => ({ ...r, kind: "Withdrawal" })),
                ]}
                rowKey={(r) => `${r.kind}${r.id}`}
                columns={[
                  { key: "k", header: "Type", primary: true, cell: (r) => `${r.kind} #${r.id}` },
                  { key: "m", header: "Member", cell: (r) => r.memberName },
                  { key: "a", header: "Amount", align: "right", cell: (r) => <MoneyDisplay value={r.amount} /> },
                  { key: "u", header: "Units", align: "right", cell: (r) => <QuantityDisplay value={r.units} /> },
                  { key: "n", header: "NAV", align: "right", cell: (r) => <MoneyDisplay value={r.nav} dp={4} /> },
                ]}
              />
            </SectionCard>
          )}
          <StrikePanel key={`${d.date}${d.official?.id ?? ""}`} daily={d} onDone={res.reload} />
        </>
      )}
    </div>
  );
}

function NavHistoryTab() {
  const res = usePoolResource<{ rows: NavSnapshot[] }>("reports", { type: "nav-history" });
  const state = resourceState(res, "NAV history");
  const rows = res.data?.rows ?? [];
  return (
    <SectionCard flush>
      {state ??
        (rows.length === 0 ? (
          <EmptyState title="No NAV struck yet" description="The first official NAV is the initial ₹10.0000." />
        ) : (
          <DataTable
            caption="NAV history"
            rows={rows}
            rowKey={(r) => r.id}
            columns={[
              { key: "d", header: "Date", primary: true, cell: (r) => <DateDisplay value={r.asOfDate} /> },
              { key: "n", header: "NAV", align: "right", cell: (r) => <MoneyDisplay value={r.nav} dp={4} /> },
              { key: "f", header: "Pool value", align: "right", cell: (r) => <MoneyDisplay value={r.fundValue} /> },
              { key: "c", header: "Cash", align: "right", cell: (r) => <MoneyDisplay value={r.cash} /> },
              { key: "u", header: "Units", align: "right", cell: (r) => <QuantityDisplay value={r.outstandingUnits} /> },
              { key: "o", header: "Status", cell: (r) => (r.isOfficial ? <StatusBadge status="FINALIZED" label="Official" /> : <StatusBadge status="REVERSED" label="Superseded" />) },
            ]}
          />
        ))}
    </SectionCard>
  );
}

function StatementTab() {
  const can = useCan();
  const { userId } = useFund();
  const [member, setMember] = useState(String(userId));
  const members = usePoolResource<{ members: Member[] }>(can("members:view_all") ? "members" : null);
  const res = usePoolResource<Statement>("reports", { type: "statement", member });
  const state = resourceState(res, "the statement");
  const s = res.data;
  return (
    <div className="space-y-6">
      {members.data && (
        <div className="max-w-xs">
          <label htmlFor="st-member" className="text-[11px] font-semibold uppercase tracking-wide text-[var(--qf-ink-soft)]">
            Member
          </label>
          <select id="st-member" className={inputClass} value={member} onChange={(e) => setMember(e.target.value)}>
            {members.data.members.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
      )}
      {state ? (
        <SectionCard flush>{state}</SectionCard>
      ) : !s ? null : (
        <>
          <SectionCard title={`Statement: ${s.member.name}`} description={s.latestNavDate ? `Valued at the official NAV of ${s.latestNavDate}.` : "No official NAV yet."}>
            <DetailGrid
              items={[
                { label: "Units", value: <QuantityDisplay value={s.position.units} /> },
                { label: "Ownership", value: s.position.ownershipPercent ? `${s.position.ownershipPercent}%` : "—" },
                { label: "Contributed", value: <MoneyDisplay value={s.position.invested} /> },
                { label: "Value", value: <MoneyDisplay value={s.position.currentValue} /> },
                { label: "XIRR (informational)", value: formatXirr(s.position.xirr) },
              ]}
            />
          </SectionCard>
          <SectionCard title="Finalized flows" flush>
            {s.entries.length === 0 ? (
              <EmptyState title="No finalized contributions or withdrawals" />
            ) : (
              <DataTable
                caption="Statement entries"
                rows={s.entries}
                rowKey={(r) => `${r.kind}${r.id}`}
                columns={[
                  { key: "d", header: "NAV date", primary: true, cell: (r) => <DateDisplay value={r.date} /> },
                  { key: "k", header: "Type", cell: (r) => `${humanize(r.kind)} #${r.id}` },
                  { key: "a", header: "Amount", align: "right", cell: (r) => <MoneyDisplay value={r.amount} /> },
                  { key: "u", header: "Units", align: "right", cell: (r) => <QuantityDisplay value={r.units} /> },
                  { key: "n", header: "NAV", align: "right", cell: (r) => <MoneyDisplay value={r.nav} dp={4} /> },
                ]}
              />
            )}
          </SectionCard>
        </>
      )}
    </div>
  );
}

type Tax = {
  disclaimer: string;
  method: string;
  assumptions: { stcgRate: string; ltcgRate: string };
  stcgGain: string;
  ltcgGain: string;
  stcgTax: string;
  ltcgTax: string;
  totalEstimatedTax: string;
};

function TaxTab() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const res = usePoolResource<Tax>("reports", { type: "tax", from: from && to ? from : null, to: from && to ? to : null });
  const state = resourceState(res, "the tax estimate");
  const t = res.data;
  return (
    <div className="space-y-6">
      <div className="grid max-w-md grid-cols-2 gap-3">
        <TextField label="From" type="date" value={from} onChange={setFrom} />
        <TextField label="To" type="date" value={to} onChange={setTo} />
      </div>
      {state ? (
        <SectionCard flush>{state}</SectionCard>
      ) : !t ? null : (
        <>
          <p className="rounded-md border-2 border-[var(--qf-brass)] px-3.5 py-2.5 font-display text-[15px] font-semibold text-[var(--qf-brass-dark)]">{t.disclaimer}</p>
          <SectionCard title="Pool-level capital gains estimate">
            <DetailGrid
              items={[
                { label: "Short-term gains", value: <MoneyDisplay value={t.stcgGain} signed /> },
                { label: `Short-term estimate (${t.assumptions.stcgRate}%)`, value: <MoneyDisplay value={t.stcgTax} /> },
                { label: "Long-term gains", value: <MoneyDisplay value={t.ltcgGain} signed /> },
                { label: `Long-term estimate (${t.assumptions.ltcgRate}%)`, value: <MoneyDisplay value={t.ltcgTax} /> },
                { label: "Total estimate", value: <MoneyDisplay value={t.totalEstimatedTax} /> },
              ]}
            />
            <p className="mt-4 text-[12.5px] text-[var(--qf-ink-soft)]">{t.method}</p>
          </SectionCard>
        </>
      )}
    </div>
  );
}

/** Trading P&L and exposure across products (migration 012 metrics; see ACCOUNTING_RULES.md section 10). */
function PositionsTab() {
  const res = usePoolResource<PositionsReportDto>("reports", { type: "positions" });
  const state = resourceState(res, "the P&L and exposure report");
  const r = res.data;
  if (state) return <SectionCard flush>{state}</SectionCard>;
  if (!r) return null;
  return (
    <div className="space-y-6">
      <SectionCard title="Pool-level trading P&L">
        <DetailGrid
          items={[
            { label: "Realized P&L (net of charges)", value: <MoneyDisplay value={r.realizedPnl} signed /> },
            { label: "Unrealized P&L", value: r.unrealizedPnl === null ? "Not available: some prices are missing" : <MoneyDisplay value={r.unrealizedPnl} signed /> },
            { label: "Trading charges", value: <MoneyDisplay value={r.tradingCharges} /> },
            { label: "Long exposure", value: <MoneyDisplay value={r.exposure?.long ?? null} /> },
            { label: "Short exposure", value: <MoneyDisplay value={r.exposure?.short ?? null} /> },
            { label: "Gross exposure", value: <MoneyDisplay value={r.exposure?.gross ?? null} /> },
            { label: "Net exposure", value: <MoneyDisplay value={r.exposure?.net ?? null} signed /> },
          ]}
        />
        <p className="mt-4 text-[12.5px] text-[var(--qf-ink-soft)]">
          Exposure is notional (quantity × latest available price); options are counted at premium value, not delta-adjusted. Unrealized P&amp;L uses display prices, not the official NAV prices.
        </p>
      </SectionCard>
      <SectionCard title="By product" flush>
        {r.byProduct.length === 0 ? (
          <EmptyState title="No trades yet" description="P&L appears once trades are executed." />
        ) : (
          <DataTable
            caption="P&L by product"
            rows={r.byProduct}
            rowKey={(x) => x.product}
            columns={[
              { key: "p", header: "Product", primary: true, cell: (x) => PRODUCT_LABEL[x.product] },
              { key: "o", header: "Open positions", align: "right", cell: (x) => String(x.openPositions) },
              { key: "r", header: "Realized", align: "right", cell: (x) => <MoneyDisplay value={x.realizedPnl} signed /> },
              { key: "u", header: "Unrealized", align: "right", cell: (x) => <MoneyDisplay value={x.unrealizedPnl} signed /> },
              { key: "c", header: "Charges", align: "right", cell: (x) => <MoneyDisplay value={x.charges} /> },
            ]}
          />
        )}
      </SectionCard>
      {r.closed.length > 0 && (
        <SectionCard title="Closed positions" flush>
          <DataTable
            caption="Closed positions"
            rows={r.closed}
            rowKey={(x) => `${x.instrumentId}:${x.product}`}
            columns={[
              { key: "i", header: "Instrument", primary: true, cell: (x) => instrumentLabel(x) },
              { key: "p", header: "Product", cell: (x) => PRODUCT_LABEL[x.product] },
              { key: "d", header: "Status", cell: (x) => <DirectionLabel direction={x.direction} /> },
              { key: "r", header: "Realized", align: "right", cell: (x) => <MoneyDisplay value={x.realizedPnl} signed /> },
            ]}
          />
        </SectionCard>
      )}
    </div>
  );
}

export function ReportsView() {
  const [tab, setTab] = useState<Tab>("daily");
  return (
    <>
      <PageHeader title="Reports" description="Read-only views of the pool's official records." />
      <div role="tablist" aria-label="Reports" className="mb-6 flex flex-wrap gap-1 border-b border-[var(--qf-line)]">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            id={`tab-${t.key}`}
            aria-selected={tab === t.key}
            aria-controls={`panel-${t.key}`}
            onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-3 py-2 text-[14px] font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--qf-brass)] ${
              tab === t.key ? "border-[var(--qf-brass)] text-[var(--qf-ink)]" : "border-transparent text-[var(--qf-ink-soft)] hover:text-[var(--qf-ink)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === "daily" && <DailyTab />}
        {tab === "nav-history" && <NavHistoryTab />}
        {tab === "statement" && <StatementTab />}
        {tab === "positions" && <PositionsTab />}
        {tab === "tax" && <TaxTab />}
      </div>
      <div className="mt-8">
        <Disclaimer>XIRR and tax figures are informational estimates. They never affect NAV, units or the ledger.</Disclaimer>
      </div>
    </>
  );
}
