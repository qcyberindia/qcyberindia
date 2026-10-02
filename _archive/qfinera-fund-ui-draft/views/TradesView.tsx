"use client";

import Link from "next/link";
import { useState } from "react";
import { Plus } from "lucide-react";
import { ApiError, endpoints, itemOf, listOf, type TradeDto } from "@/components/fund/api";
import { DateDisplay, MoneyDisplay, QuantityDisplay, StatusBadge } from "@/components/fund/display";
import { humanize } from "@/components/fund/format";
import { DecimalField, SelectField, TextAreaField, TextField, inputClass } from "@/components/fund/forms";
import { FormDialog } from "@/components/fund/overlays";
import { Disclaimer, EmptyState, PageHeader, SectionCard, btnPrimary } from "@/components/fund/parts";
import { useNotice } from "@/components/fund/notices";
import { useCan } from "@/components/fund/session";
import { useFundMutation, useFundResource } from "@/components/fund/useResource";
import { FUND_BASE, recordHref } from "@/components/fund/nav";
import { isPositiveDecimal, resourceState } from "@/components/fund/common";
import { StickyAction } from "@/components/fund/shell";
import { DataTable, FilterBar, FilterField, Pagination, SearchInput } from "@/components/fund/table";
import { ApprovalPanel, DetailGrid, type WorkflowAction } from "@/components/fund/workflow";
import { SideLabel, tradeColumns } from "@/components/fund/views/columns";
import { InstrumentSelect } from "@/components/fund/views/InstrumentSelect";

const PAGE_SIZE = 25;
const TRADE_STATUSES = ["DRAFT", "EXECUTED", "SETTLED", "CANCELLED", "REVERSED", "FINALIZED"] as const;
const SIDE_OPTIONS = [
  { value: "BUY", label: "Buy" },
  { value: "SELL", label: "Sell" },
] as const;
const CHARGES = [
  { key: "brokerage", label: "Brokerage" },
  { key: "stt", label: "STT" },
  { key: "gst", label: "GST" },
  { key: "stampDuty", label: "Stamp duty" },
  { key: "otherCharges", label: "Other charges" },
] as const;

type ChargeKey = (typeof CHARGES)[number]["key"];
const NO_CHARGES: Record<ChargeKey, string> = { brokerage: "", stt: "", gst: "", stampDuty: "", otherCharges: "" };

function NewTradeDialog({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const can = useCan();
  const { run, pending } = useFundMutation();
  const { notify } = useNotice();
  const [instrumentId, setInstrumentId] = useState("");
  const [side, setSide] = useState<string>("BUY");
  const [tradeDate, setTradeDate] = useState("");
  const [settlementDate, setSettlementDate] = useState("");
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [charges, setCharges] = useState<Record<ChargeKey, string>>(NO_CHARGES);
  const [externalRef, setExternalRef] = useState("");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const local: Record<string, string> = {};
    if (!instrumentId) local.instrumentId = "Choose an instrument.";
    if (!isPositiveDecimal(quantity, 4)) local.quantity = "Enter a quantity greater than zero, with up to 4 decimal places.";
    if (!isPositiveDecimal(price, 4)) local.price = "Enter a price greater than zero, with up to 4 decimal places.";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tradeDate)) local.tradeDate = "Choose the trade date.";
    if (settlementDate && tradeDate && settlementDate < tradeDate) local.settlementDate = "Settlement cannot be before the trade date.";
    for (const c of CHARGES) {
      if (charges[c.key] && !/^\d+(\.\d{1,2})?$/.test(charges[c.key])) local[c.key] = "Use a number with up to 2 decimal places.";
    }
    setErrors(local);
    if (Object.keys(local).length > 0) return;
    setError(null);
    try {
      await run(endpoints.trades, {
        body: {
          instrumentId: Number(instrumentId),
          side,
          tradeDate,
          settlementDate: settlementDate || null,
          quantity,
          price,
          brokerage: charges.brokerage || "0",
          stt: charges.stt || "0",
          gst: charges.gst || "0",
          stampDuty: charges.stampDuty || "0",
          otherCharges: charges.otherCharges || "0",
          externalRef: externalRef.trim() || null,
          notes: notes.trim() || null,
        },
      });
      notify("success", "Trade recorded. The fund has calculated its value and updated holdings.");
      setInstrumentId("");
      setQuantity("");
      setPrice("");
      setCharges(NO_CHARGES);
      setExternalRef("");
      setNotes("");
      onClose();
      onDone();
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fields ?? {});
        setError(err.message);
      } else setError("Something went wrong. Please try again.");
    }
  }

  return (
    <FormDialog open={open} onClose={onClose} title="Record a trade" description="Enter the trade exactly as it was executed." submitLabel="Record trade" pending={pending} error={error} onSubmit={submit}>
      <Disclaimer>Net value, holdings, average cost and profit and loss are calculated by the fund after you save. Nothing on this form is an accounting result.</Disclaimer>
      <InstrumentSelect required value={instrumentId} onChange={setInstrumentId} error={errors.instrumentId} />
      <SelectField label="Side" value={side} onChange={setSide} options={SIDE_OPTIONS} error={errors.side} />
      <div className="grid gap-4 sm:grid-cols-2">
        <DecimalField label="Quantity" required decimals={4} value={quantity} onChange={setQuantity} error={errors.quantity} />
        <DecimalField label="Price per unit (INR)" required decimals={4} value={price} onChange={setPrice} error={errors.price} />
        <TextField label="Trade date" type="date" required value={tradeDate} onChange={setTradeDate} error={errors.tradeDate} hint={can("trades:backdate") ? undefined : "Back-dated trades need administrator permission."} />
        <TextField label="Settlement date" type="date" value={settlementDate} onChange={setSettlementDate} error={errors.settlementDate} />
      </div>
      <details className="rounded-md border border-[var(--qf-line)] px-3 py-2">
        <summary className="cursor-pointer text-[13.5px] font-semibold text-[var(--qf-ink)]">Charges (optional)</summary>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          {CHARGES.map((c) => (
            <DecimalField key={c.key} label={`${c.label} (INR)`} decimals={2} value={charges[c.key]} onChange={(v) => setCharges((prev) => ({ ...prev, [c.key]: v }))} error={errors[c.key]} placeholder="0" />
          ))}
        </div>
      </details>
      <TextField label="External reference" value={externalRef} onChange={setExternalRef} maxLength={60} hint="Broker contract note or order number." error={errors.externalRef} />
      <TextAreaField label="Notes" value={notes} onChange={setNotes} maxLength={500} error={errors.notes} />
    </FormDialog>
  );
}

export function TradesView() {
  const can = useCan();
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [side, setSide] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");
  const res = useFundResource(endpoints.trades, { page, pageSize: PAGE_SIZE, status, side, from, to, q }, (j) => listOf<TradeDto>(j));
  const state = resourceState(res, "trades");
  const list = res.data;
  const dirty = Boolean(status || side || from || to || q);
  const create = can("trades:create") ? (
    <button type="button" className={btnPrimary} onClick={() => setOpen(true)}>
      <Plus size={15} aria-hidden="true" /> Record trade
    </button>
  ) : null;

  return (
    <>
      <PageHeader title="Trades" description="Every buy and sell the fund has made." actions={create ? <div className="hidden lg:block">{create}</div> : undefined} />
      <FilterBar dirty={dirty} onReset={() => { setStatus(""); setSide(""); setFrom(""); setTo(""); setQ(""); setPage(1); }}>
        <SearchInput key={q} label="Search by symbol" placeholder="e.g. RELIANCE" applied={q} onSearch={(v) => { setQ(v); setPage(1); }} />
        <FilterField label="Side">
          {(id) => (
            <select id={id} className={inputClass} value={side} onChange={(e) => { setSide(e.target.value); setPage(1); }}>
              <option value="">Buy and sell</option>
              <option value="BUY">Buy</option>
              <option value="SELL">Sell</option>
            </select>
          )}
        </FilterField>
        <FilterField label="Status">
          {(id) => (
            <select id={id} className={inputClass} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
              <option value="">All statuses</option>
              {TRADE_STATUSES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
            </select>
          )}
        </FilterField>
        <FilterField label="From date">
          {(id) => <input id={id} type="date" className={inputClass} value={from} max={to || undefined} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />}
        </FilterField>
        <FilterField label="To date">
          {(id) => <input id={id} type="date" className={inputClass} value={to} min={from || undefined} onChange={(e) => { setTo(e.target.value); setPage(1); }} />}
        </FilterField>
      </FilterBar>
      <SectionCard flush>
        {state ?? (list && list.items.length > 0 ? (
          <>
            <DataTable columns={tradeColumns(true)} rows={list.items} rowKey={(r) => r.id} rowHref={(r) => recordHref("trades", r.id)} caption="Trades" />
            <Pagination page={page} pageSize={PAGE_SIZE} total={list.total} count={list.items.length} onPage={setPage} />
          </>
        ) : (
          <EmptyState
            title={dirty ? "No trades match these filters" : "No trades yet"}
            description={dirty ? "Try clearing a filter." : "Recorded trades appear here."}
            action={!dirty && create ? create : undefined}
          />
        ))}
      </SectionCard>
      {create && <StickyAction>{create}</StickyAction>}
      <NewTradeDialog open={open} onClose={() => setOpen(false)} onDone={res.reload} />
    </>
  );
}

export function TradeDetailView({ id }: { id: number }) {
  const can = useCan();
  const res = useFundResource(`${endpoints.trades}/${id}`, {}, (j) => itemOf<TradeDto>(j));
  const state = resourceState(res, "trade");
  const t = res.data;

  const actions: WorkflowAction[] = [];
  if (t) {
    if (t.status === "DRAFT" && can("trades:create")) {
      actions.push({ key: "cancel", label: "Cancel draft", title: "Cancel this draft trade?", consequences: "The draft is closed. Holdings and cash are not affected because it was never executed.", variant: "danger", success: "Draft trade cancelled." });
    }
    if ((t.status === "EXECUTED" || t.status === "SETTLED") && can("trades:reverse")) {
      actions.push({ key: "reverse", label: "Reverse trade", title: "Reverse this trade?", consequences: "A reversing entry is recorded. The original trade stays in the history and your reason is audited. The fund checks that the reversal keeps its books consistent and rejects it if not.", variant: "danger", reasonLabel: "Reason for reversing", success: "Trade reversed." });
    }
  }

  return (
    <>
      <p className="mb-3 text-[13px]">
        <Link className="text-[var(--qf-brass-dark)] underline underline-offset-2" href={`${FUND_BASE}/trades`}>&larr; All trades</Link>
      </p>
      {state ? (
        <SectionCard flush>{state}</SectionCard>
      ) : !t ? (
        <SectionCard><EmptyState title="Trade not found" /></SectionCard>
      ) : (
        <div className="space-y-6">
          <PageHeader title={`Trade #${t.id}`} description={`${t.symbol} \u00B7 ${t.exchange}`} actions={<StatusBadge status={t.status} />} />
          <SectionCard title="Trade">
            <DetailGrid
              items={[
                { label: "Side", value: <SideLabel side={t.side} /> },
                { label: "Instrument", value: `${t.symbol} \u00B7 ${t.exchange}` },
                { label: "Quantity", value: <QuantityDisplay value={t.quantity} /> },
                { label: "Price", value: <MoneyDisplay value={t.price} dp={4} /> },
                { label: "Trade date", value: <DateDisplay value={t.trade_date} /> },
                { label: "Settlement date", value: t.settlement_date ? <DateDisplay value={t.settlement_date} /> : "Not set" },
                { label: "Net value", value: <MoneyDisplay value={t.net_value} /> },
                { label: "External reference", value: t.external_ref ?? "None" },
                { label: "Recorded", value: <DateDisplay value={t.created_at} /> },
              ]}
            />
          </SectionCard>
          <SectionCard title="Charges">
            <DetailGrid
              items={[
                { label: "Brokerage", value: <MoneyDisplay value={t.brokerage} /> },
                { label: "STT", value: <MoneyDisplay value={t.stt} /> },
                { label: "GST", value: <MoneyDisplay value={t.gst} /> },
                { label: "Stamp duty", value: <MoneyDisplay value={t.stamp_duty} /> },
                { label: "Other charges", value: <MoneyDisplay value={t.other_charges} /> },
              ]}
            />
          </SectionCard>
          {(t.notes || t.reversal_reason) && (
            <SectionCard title="Notes">
              {t.notes && <p className="whitespace-pre-wrap text-[14px] text-[var(--qf-ink)]">{t.notes}</p>}
              {t.reversal_reason && (
                <p className="mt-3 text-[14px] text-[var(--qf-ink)]"><span className="font-semibold">Reason for reversal: </span>{t.reversal_reason}</p>
              )}
            </SectionCard>
          )}
          {actions.length > 0 && <ApprovalPanel heading="Actions" basePath={endpoints.trades} id={t.id} actions={actions} onDone={res.reload} />}
        </div>
      )}
    </>
  );
}
