"use client";

import { useState } from "react";
import Link from "next/link";
import { Pencil } from "lucide-react";
import { errorMessage, type InstrumentDto, type TradeDetailDto } from "@/components/fund/api";
import { isPositiveDecimal, resourceState } from "@/components/fund/common";
import { DateDisplay, MoneyDisplay, QuantityDisplay, StatusBadge } from "@/components/fund/display";
import { formatCalendarDate, formatMoney, humanize } from "@/components/fund/format";
import { poolBase } from "@/components/fund/nav";
import { DecimalField, SelectField, TextAreaField, TextField } from "@/components/fund/forms";
import { useNotice } from "@/components/fund/notices";
import { FormDialog } from "@/components/fund/overlays";
import { PageHeader, SectionCard, btnPrimary } from "@/components/fund/parts";
import { useCan, useFund } from "@/components/fund/session";
import { DataTable } from "@/components/fund/table";
import { usePoolMutation, usePoolResource } from "@/components/fund/useResource";
import { ActionPanel, AuditTrail, DetailGrid, StageTracker, type WorkflowAction } from "@/components/fund/workflow";
import { SideLabel, ACTION_LABEL, InstrumentPicker, InstrumentSummary, PRODUCT_LABEL, type InstrumentKind } from "@/components/fund/views/shared";

const STAGES = [
  { key: "DRAFT", label: "Draft", hint: "Recorded for review. No effect on cash or holdings." },
  { key: "EXECUTED", label: "Executed", hint: "Cash and holdings changed on the trade date." },
  { key: "SETTLED", label: "Settled", hint: "Broker settlement confirmed (informational)." },
];

type Trade = TradeDetailDto["trade"];

const PRODUCT_KIND: Record<string, InstrumentKind> = { EQUITY_DELIVERY: "EQUITY", EQUITY_INTRADAY: "EQUITY", FUTURES: "FUTURE", OPTIONS: "OPTION" };

/**
 * ADMIN correction of an executed trade. The server keeps the previous
 * values (revision + audit), re-derives positions and posts dated cash
 * adjustments; it refuses anything the normal trade rules would refuse.
 */
function EditTrade({ t, totalCharges, open, onClose, onDone }: { t: Trade; totalCharges: string; open: boolean; onClose: () => void; onDone: () => void }) {
  const { run, pending } = usePoolMutation();
  const { notify } = useNotice();
  const [product, setProduct] = useState(t.product);
  const [action, setAction] = useState(t.position_action);
  const [instrument, setInstrument] = useState<InstrumentDto | null>({
    id: t.instrument_id,
    symbol: t.symbol,
    exchange: t.exchange as InstrumentDto["exchange"],
    name: t.instrument_name,
    instrumentType: t.instrument_type,
    underlying: t.underlying_symbol,
    expiryDate: t.expiry_date,
    strikePrice: t.strike_price,
    optionType: t.option_type,
  });
  const [tradeDate, setTradeDate] = useState(t.trade_date);
  const [settlementDate, setSettlementDate] = useState(t.settlement_date ?? "");
  const [quantity, setQuantity] = useState(t.quantity);
  const [price, setPrice] = useState(t.price);
  const [estimatedCharges, setEstimatedCharges] = useState(totalCharges);
  const [externalRef, setExternalRef] = useState(t.external_ref ?? "");
  const [notes, setNotes] = useState(t.notes ?? "");
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const longOnly = product === "EQUITY_DELIVERY";

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title={`Edit trade #${t.id}`}
      description="Match the contract note. Previous values stay in the revision history and audit trail; positions, cash and P&L are recalculated."
      submitLabel="Save correction"
      pending={pending}
      error={error}
      onSubmit={async () => {
        setError(null);
        if (!instrument) return setError("Choose an instrument.");
        if (reason.trim().length < 10) return setError("Give a correction reason of at least 10 characters.");
        if (!isPositiveDecimal(quantity, 4) || !isPositiveDecimal(price, 4)) return setError("Quantity and price must be greater than zero (up to 4 decimals).");
        try {
          const r = await run<{ adjustments: unknown[]; affectedOfficialNavDates: string[] }>(`trades/${t.id}`, {
            action: "correct",
            trade: { instrumentId: instrument.id, product, action, tradeDate, quantity, price, estimatedCharges: estimatedCharges.trim() || "0" },
            settlementDate: settlementDate || undefined,
            externalRef: externalRef.trim() || undefined,
            notes: notes.trim() || undefined,
            reason: reason.trim(),
            confirm,
          });
          notify(
            "success",
            r.affectedOfficialNavDates.length > 0
              ? `Trade corrected. Official NAVs already struck for ${r.affectedOfficialNavDates.join(", ")} were not changed; strike a NAV correction if needed.`
              : `Trade corrected${r.adjustments.length ? `; ${r.adjustments.length} cash adjustment${r.adjustments.length === 1 ? "" : "s"} posted` : ""}.`
          );
          onDone();
          onClose();
        } catch (err) {
          setError(errorMessage(err));
        }
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Product"
          value={product}
          onChange={(v) => {
            const next = v as Trade["product"];
            if (PRODUCT_KIND[next] !== PRODUCT_KIND[product]) setInstrument(null);
            if (next === "EQUITY_DELIVERY" && action.endsWith("SHORT")) setAction("OPEN_LONG");
            setProduct(next);
          }}
          options={Object.entries(PRODUCT_LABEL).map(([value, label]) => ({ value, label }))}
        />
        <SelectField
          label="Position"
          value={action}
          onChange={(v) => setAction(v as Trade["position_action"])}
          options={Object.entries(ACTION_LABEL)
            .filter(([value]) => !(longOnly && value.endsWith("SHORT")))
            .map(([value, label]) => ({ value, label }))}
        />
      </div>
      <InstrumentPicker key={PRODUCT_KIND[product]} kind={PRODUCT_KIND[product]} value={instrument} onChange={setInstrument} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Trade date" type="date" value={tradeDate} onChange={setTradeDate} required />
        <TextField label="Settlement date" type="date" value={settlementDate} onChange={setSettlementDate} />
        <DecimalField label="Quantity" value={quantity} onChange={setQuantity} decimals={4} required />
        <DecimalField label="Price (₹)" value={price} onChange={setPrice} decimals={4} required />
      </div>
      <DecimalField label="Estimated charges (₹)" value={estimatedCharges} onChange={setEstimatedCharges} decimals={2} hint="One total. QFinera does not calculate broker charges." />
      <TextField label="Contract note / broker reference" value={externalRef} onChange={setExternalRef} maxLength={64} />
      <TextAreaField label="Notes" value={notes} onChange={setNotes} maxLength={1000} rows={2} />
      <TextAreaField label="Correction reason" value={reason} onChange={setReason} maxLength={500} rows={2} required hint="At least 10 characters. Shown in the revision history and audit trail." />
      <label className="flex items-start gap-2 text-[13px]">
        <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} className="mt-0.5 h-4 w-4" />
        If this changes cash on or before the latest official NAV, I confirm the correction. Official NAVs already struck are kept unchanged.
      </label>
    </FormDialog>
  );
}

function valueText(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "object") {
    // Charges object: show the total, summed exactly as paise (decimal strings, no floats).
    const c = v as Record<string, string>;
    const paise = ["brokerage", "stt", "gst", "stamp_duty", "other_charges"].reduce((sum, k) => {
      const [w, f = ""] = (c[k] ?? "0").split(".");
      return sum + BigInt(w) * 100n + BigInt((f + "00").slice(0, 2));
    }, 0n);
    return formatMoney(`${paise / 100n}.${String(paise % 100n).padStart(2, "0")}`);
  }
  return String(v);
}

const REVISION_FIELDS: Array<[string, string]> = [
  ["instrument", "Instrument"],
  ["product", "Product"],
  ["position_action", "Position"],
  ["trade_date", "Trade date"],
  ["quantity", "Quantity"],
  ["price", "Price"],
  ["charges", "Charges"],
  ["settlement_date", "Settlement date"],
  ["external_ref", "Broker reference"],
  ["notes", "Notes"],
];

function Revisions({ revisions }: { revisions: TradeDetailDto["revisions"] }) {
  return (
    <ol className="divide-y divide-[var(--qf-line)]">
      {revisions.map((r) => {
        const changed = REVISION_FIELDS.filter(([k]) => JSON.stringify(r.beforeValues[k]) !== JSON.stringify(r.afterValues[k]));
        return (
          <li key={r.revision} className="px-4 py-3 text-[13.5px]">
            <p className="font-semibold">
              Revision {r.revision} · {r.correctedByName ?? "Administrator"} · <DateDisplay value={r.correctedAt} />
            </p>
            <p className="mt-0.5 text-[var(--qf-ink-soft)]">Reason: {r.reason}</p>
            <ul className="mt-2 space-y-0.5">
              {changed.map(([k, label]) => (
                <li key={k}>
                  {label}: <span className="line-through opacity-70">{valueText(r.beforeValues[k])}</span> → <strong>{valueText(r.afterValues[k])}</strong>
                </li>
              ))}
            </ul>
          </li>
        );
      })}
    </ol>
  );
}

export function TradeDetail({ id, initialEdit = false }: { id: string; initialEdit?: boolean }) {
  const can = useCan();
  const { poolId } = useFund();
  const valid = /^\d{1,9}$/.test(id);
  const res = usePoolResource<TradeDetailDto>(valid ? `trades/${id}` : null);
  const state = valid ? resourceState(res, "the trade") : null;
  const d = res.data;
  const t = d?.trade;
  const [editing, setEditing] = useState(initialEdit);
  const canEdit = t !== undefined && ["EXECUTED", "SETTLED", "FINALIZED"].includes(t.status) && can("trades:correct");

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
      <PageHeader
        eyebrow={<Link href={`${poolBase(poolId)}/trades`} className="underline-offset-2 hover:underline">← Trades</Link>}
        title={t ? `Trade #${t.id} · ${t.symbol}` : "Trade"}
        description={t ? `${PRODUCT_LABEL[t.product]} · ${ACTION_LABEL[t.position_action]} · ${formatCalendarDate(t.trade_date)}` : undefined}
        actions={
          canEdit ? (
            <button type="button" className={btnPrimary} onClick={() => setEditing(true)}>
              <Pencil size={15} aria-hidden="true" /> Edit trade
            </button>
          ) : undefined
        }
      />
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
                {
                  label: "Instrument",
                  value: (
                    <InstrumentSummary
                      i={{ symbol: t.symbol, exchange: t.exchange, instrumentType: t.instrument_type, underlying: t.underlying_symbol, expiryDate: t.expiry_date, strikePrice: t.strike_price, optionType: t.option_type }}
                      name={t.instrument_name}
                    />
                  ),
                },
                { label: "Product", value: PRODUCT_LABEL[t.product] },
                { label: "Position action", value: ACTION_LABEL[t.position_action] },
                { label: "Side", value: <SideLabel side={t.side} /> },
                { label: "Status", value: <StatusBadge status={t.status} /> },
                { label: "Trade date", value: <DateDisplay value={t.trade_date} /> },
                { label: "Settlement date", value: <DateDisplay value={t.settlement_date} /> },
                { label: "Quantity", value: <QuantityDisplay value={t.quantity} /> },
                { label: "Price", value: <MoneyDisplay value={t.price} dp={4} /> },
                { label: "Gross", value: <MoneyDisplay value={d.computation.gross} /> },
                { label: "Estimated charges", value: <MoneyDisplay value={d.computation.totalCharges} /> },
                { label: "Net value", value: <MoneyDisplay value={d.computation.net} /> },
                { label: "Cash effect", value: <MoneyDisplay value={d.computation.cashDelta} signed /> },
                { label: "Broker reference", value: t.external_ref ?? "—" },
                { label: "Backdated", value: t.is_backdated ? `Yes: ${t.backdated_reason ?? ""}` : "No" },
                { label: "Reversal reason", value: t.reversal_reason ?? "—" },
                { label: "Notes", value: t.notes ?? "—" },
                { label: "Corrections", value: t.correction_count > 0 ? `${t.correction_count} (last ${new Date(t.corrected_at ?? "").toLocaleDateString("en-IN")})` : "None" },
              ]}
            />
          </SectionCard>
          {d.revisions.length > 0 && (
            <SectionCard title="Revision history" description="Every correction, with the values before and after. Nothing is overwritten silently." flush>
              <Revisions revisions={d.revisions} />
            </SectionCard>
          )}
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
          {canEdit && <EditTrade key={`${t.id}:${t.correction_count}:${editing}`} t={t} totalCharges={d.computation.totalCharges} open={editing} onClose={() => setEditing(false)} onDone={res.reload} />}
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
