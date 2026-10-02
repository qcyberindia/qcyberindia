"use client";

import Link from "next/link";
import type { TradeDetailDto } from "@/components/fund/api";
import { resourceState } from "@/components/fund/common";
import { DateDisplay, MoneyDisplay, QuantityDisplay, StatusBadge } from "@/components/fund/display";
import { humanize } from "@/components/fund/format";
import { poolBase } from "@/components/fund/nav";
import { PageHeader, SectionCard } from "@/components/fund/parts";
import { useCan, useFund } from "@/components/fund/session";
import { DataTable } from "@/components/fund/table";
import { usePoolResource } from "@/components/fund/useResource";
import { ActionPanel, AuditTrail, DetailGrid, StageTracker, type WorkflowAction } from "@/components/fund/workflow";
import { SideLabel } from "@/components/fund/views/shared";

const STAGES = [
  { key: "DRAFT", label: "Draft", hint: "Recorded for review. No effect on cash or holdings." },
  { key: "EXECUTED", label: "Executed", hint: "Cash and holdings changed on the trade date." },
  { key: "SETTLED", label: "Settled", hint: "Broker settlement confirmed (informational)." },
];

export function TradeDetail({ id }: { id: string }) {
  const can = useCan();
  const { poolId } = useFund();
  const valid = /^\d{1,9}$/.test(id);
  const res = usePoolResource<TradeDetailDto>(valid ? `trades/${id}` : null);
  const state = valid ? resourceState(res, "the trade") : null;
  const d = res.data;
  const t = d?.trade;

  const actions: WorkflowAction[] = [];
  if (t) {
    if (t.status === "DRAFT" && can("trades:create")) {
      actions.push({ key: "execute", label: "Execute", title: "Execute this trade?", consequences: "Cash and holdings change on the trade date. Overselling or negative cash is refused.", backdate: can("trades:backdate"), success: "Trade executed." });
      actions.push({ key: "cancel", label: "Cancel draft", variant: "secondary", title: "Cancel this draft?", consequences: "The draft is closed. It never affected cash or holdings.", reason: { label: "Reason", min: 3, optional: true }, success: "Draft cancelled." });
    }
    if ((t.status === "EXECUTED" || t.status === "FINALIZED") && can("trades:create")) {
      actions.push({ key: "settle", label: "Mark settled", variant: "secondary", title: "Mark as settled?", consequences: "Records that the broker settled this trade. It does not change cash or holdings.", success: "Trade marked settled." });
    }
    if (["EXECUTED", "SETTLED", "FINALIZED"].includes(t.status) && can("trades:reverse")) {
      actions.push({
        key: "reverse",
        label: "Reverse",
        variant: "danger",
        title: "Reverse this trade?",
        consequences: "A reversal ledger entry dated today undoes the cash effect; the original trade and entries are kept. Refused if it would oversell or make cash negative.",
        reason: { label: "Reason", min: 10 },
        confirmText: "I confirm this correction.",
        success: "Trade reversed.",
      });
    }
  }

  return (
    <>
      <PageHeader eyebrow="Trade" title={t ? `Trade #${t.id} · ${t.symbol}` : "Trade"} actions={<Link href={`${poolBase(poolId)}/trades`} className="text-[13px] underline">Back to trades</Link>} />
      {state ? (
        <SectionCard flush>{state}</SectionCard>
      ) : !t || !d ? null : (
        <div className="space-y-6">
          <SectionCard title="Progress">
            <StageTracker stages={STAGES} status={t.status === "FINALIZED" ? "EXECUTED" : t.status} />
          </SectionCard>
          <SectionCard title="Details">
            <DetailGrid
              items={[
                { label: "Instrument", value: `${t.symbol} · ${t.exchange}${t.instrument_name ? ` · ${t.instrument_name}` : ""}` },
                { label: "Side", value: <SideLabel side={t.side} /> },
                { label: "Status", value: <StatusBadge status={t.status} /> },
                { label: "Trade date", value: <DateDisplay value={t.trade_date} /> },
                { label: "Settlement date", value: <DateDisplay value={t.settlement_date} /> },
                { label: "Quantity", value: <QuantityDisplay value={t.quantity} /> },
                { label: "Price", value: <MoneyDisplay value={t.price} dp={4} /> },
                { label: "Gross", value: <MoneyDisplay value={d.computation.gross} /> },
                { label: "Total charges", value: <MoneyDisplay value={d.computation.totalCharges} /> },
                { label: "Net value", value: <MoneyDisplay value={d.computation.net} /> },
                { label: "Cash effect", value: <MoneyDisplay value={d.computation.cashDelta} signed /> },
                { label: "Broker reference", value: t.external_ref ?? "—" },
                { label: "Backdated", value: t.is_backdated ? `Yes: ${t.backdated_reason ?? ""}` : "No" },
                { label: "Reversal reason", value: t.reversal_reason ?? "—" },
                { label: "Notes", value: t.notes ?? "—" },
              ]}
            />
            <p className="mt-4 text-[12.5px] text-[var(--qf-ink-soft)]">
              Charges: brokerage ₹{t.brokerage}, STT ₹{t.stt}, GST ₹{t.gst}, stamp duty ₹{t.stamp_duty}, other ₹{t.other_charges}.
            </p>
          </SectionCard>
          <ActionPanel path={`trades/${t.id}`} actions={actions} onDone={res.reload} />
          {d.ledger.length > 0 && (
            <SectionCard title="Ledger entries" flush>
              <DataTable
                caption="Ledger entries for this trade"
                rows={d.ledger}
                rowKey={(r) => r.id}
                columns={[
                  { key: "t", header: "Entry", primary: true, cell: (r) => `${humanize(r.entryType)} #${r.id}` },
                  { key: "d", header: "Date", cell: (r) => <DateDisplay value={r.entryDate} /> },
                  { key: "c", header: "Cash", align: "right", cell: (r) => <MoneyDisplay value={r.cashDelta} signed /> },
                  { key: "b", header: "Backdated", cell: (r) => (r.isBackdated ? "Yes" : "No") },
                ]}
              />
            </SectionCard>
          )}
          {d.audit && (
            <SectionCard title="Audit trail" flush>
              <AuditTrail items={d.audit} />
            </SectionCard>
          )}
        </div>
      )}
    </>
  );
}
