"use client";

import { useState } from "react";
import { errorMessage, type Holdings, type InstrumentDto } from "@/components/fund/api";
import { isPositiveDecimal, resourceState } from "@/components/fund/common";
import { DateDisplay, MoneyDisplay, QualityBadge, QuantityDisplay } from "@/components/fund/display";
import { DecimalField, SegmentedField, SelectField, TextField } from "@/components/fund/forms";
import { useNotice } from "@/components/fund/notices";
import { FormDialog } from "@/components/fund/overlays";
import { Disclaimer, EmptyState, FinancialMetric, PageHeader, SectionCard, btnPrimary, btnSecondary } from "@/components/fund/parts";
import { useCan } from "@/components/fund/session";
import { DataTable } from "@/components/fund/table";
import { usePoolMutation, usePoolResource } from "@/components/fund/useResource";
import {
  DirectionLabel,
  InstrumentPicker,
  PRODUCT_LABEL,
  instrumentLabel,
  todayIstInput,
  type InstrumentKind,
} from "@/components/fund/views/shared";

function AddInstrument({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { run, pending } = usePoolMutation();
  const { notify } = useNotice();
  const [kind, setKind] = useState<InstrumentKind>("EQUITY");
  const [symbol, setSymbol] = useState("");
  const [exchange, setExchange] = useState("NSE");
  const [name, setName] = useState("");
  const [underlying, setUnderlying] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [strikePrice, setStrikePrice] = useState("");
  const [optionType, setOptionType] = useState("CE");
  const [lotSize, setLotSize] = useState("");
  const [error, setError] = useState<string | null>(null);
  const contract = kind !== "EQUITY";
  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title={contract ? "Add a derivative contract" : "Add an instrument"}
      description={
        contract
          ? "Define one futures or options contract (underlying, expiry and, for options, strike and CE/PE). Contracts are separate from equity rows and shared by every pool."
          : "Add an NSE or BSE listed equity so trades and watchlist notes can refer to it. Most are already in the NSE master."
      }
      submitLabel={contract ? "Add contract" : "Add instrument"}
      pending={pending}
      error={error}
      onSubmit={async () => {
        setError(null);
        try {
          await run(
            "instruments",
            contract
              ? {
                  instrumentType: kind,
                  exchange,
                  underlying,
                  expiryDate,
                  ...(kind === "OPTION" ? { strikePrice, optionType } : {}),
                  ...(lotSize.trim() ? { lotSize: lotSize.trim() } : {}),
                }
              : { symbol, exchange, name: name.trim() || undefined }
          );
          notify("success", contract ? "Contract added." : "Instrument added.");
          onClose();
        } catch (err) {
          setError(errorMessage(err));
        }
      }}
    >
      <SegmentedField<InstrumentKind>
        label="Type"
        value={kind}
        onChange={setKind}
        options={[
          { value: "EQUITY", label: "Equity" },
          { value: "FUTURE", label: "Future" },
          { value: "OPTION", label: "Option" },
        ]}
      />
      {contract ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Underlying" value={underlying} onChange={(v) => setUnderlying(v.toUpperCase())} required maxLength={30} hint="e.g. NIFTY, BANKNIFTY, INFY." />
            <TextField label="Expiry" type="date" value={expiryDate} onChange={setExpiryDate} required />
          </div>
          {kind === "OPTION" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <DecimalField label="Strike (₹)" value={strikePrice} onChange={setStrikePrice} decimals={4} required />
              <SelectField label="Option type" value={optionType} onChange={setOptionType} options={[{ value: "CE", label: "CE (call)" }, { value: "PE", label: "PE (put)" }]} />
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Lot size" value={lotSize} onChange={setLotSize} maxLength={9} hint="Optional. When set, quantities must be whole lots." />
            <SelectField label="Exchange" value={exchange} onChange={setExchange} options={[{ value: "NSE", label: "NSE" }, { value: "BSE", label: "BSE" }]} />
          </div>
        </>
      ) : (
        <>
          <TextField label="Exchange symbol" value={symbol} onChange={(v) => setSymbol(v.toUpperCase())} required maxLength={30} hint="As listed, e.g. INFY or M&M." />
          <SelectField label="Exchange" value={exchange} onChange={setExchange} options={[{ value: "NSE", label: "NSE" }, { value: "BSE", label: "BSE" }]} />
          <TextField label="Name" value={name} onChange={setName} maxLength={120} />
        </>
      )}
    </FormDialog>
  );
}

function RecordPrice({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const { run, pending } = usePoolMutation();
  const { notify } = useNotice();
  const [kind, setKind] = useState<InstrumentKind>("EQUITY");
  const [instrument, setInstrument] = useState<InstrumentDto | null>(null);
  const [price, setPrice] = useState("");
  const [quality, setQuality] = useState("EOD");
  const [date, setDate] = useState(todayIstInput());
  const [time, setTime] = useState("15:30");
  const [error, setError] = useState<string | null>(null);
  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title="Record a price"
      description="Closing (end-of-day) prices value positions for the official NAV of that day. Prices are kept as history: a correction is a newer entry, never an edit."
      submitLabel="Record price"
      pending={pending}
      error={error}
      onSubmit={async () => {
        setError(null);
        if (!instrument) return setError("Choose an instrument.");
        if (!isPositiveDecimal(price, 4)) return setError("Enter a price greater than zero (up to 4 decimals).");
        try {
          await run(`instruments/${instrument.id}`, { action: "record-price", price, quality, date, time });
          notify("success", "Price recorded.");
          onDone();
          onClose();
        } catch (err) {
          setError(errorMessage(err));
        }
      }}
    >
      <SegmentedField<InstrumentKind>
        label="Instrument type"
        value={kind}
        onChange={(k) => {
          setKind(k);
          setInstrument(null);
        }}
        options={[
          { value: "EQUITY", label: "Equity" },
          { value: "FUTURE", label: "Future" },
          { value: "OPTION", label: "Option" },
        ]}
      />
      <InstrumentPicker key={kind} kind={kind} value={instrument} onChange={setInstrument} />
      <DecimalField label="Price (₹)" value={price} onChange={setPrice} decimals={4} required />
      <SelectField
        label="Type"
        value={quality}
        onChange={setQuality}
        options={[
          { value: "EOD", label: "End-of-day closing price" },
          { value: "MANUAL", label: "Manual (other operator-entered price)" },
        ]}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Date" type="date" value={date} onChange={setDate} required />
        <TextField label="Time (IST, HH:MM)" value={time} onChange={setTime} maxLength={5} />
      </div>
    </FormDialog>
  );
}

type Filter = "ALL" | "LONG" | "SHORT" | "CLOSED";
type Category = "ALL" | "EQUITY" | "FUTURE" | "OPTION";
type Row = Holdings["rows"][number];

function PositionsTable({ rows, caption, closed, delivery = false }: { rows: readonly Row[]; caption: string; closed: boolean; delivery?: boolean }) {
  return (
    <DataTable
      caption={caption}
      rows={[...rows]}
      rowKey={(r) => `${r.instrumentId}:${r.product}`}
      columns={[
        {
          key: "s",
          header: "Instrument",
          primary: true,
          cell: (r) => (
            <span className="block max-w-[16rem]">
              <span className="whitespace-nowrap font-semibold">{instrumentLabel(r)}</span>
              <span className="block truncate text-[12px] font-normal text-[var(--qf-ink-soft)]" title={r.name ?? undefined}>
                {r.exchange} · {r.product === "EQUITY_DELIVERY" ? (r.name ?? "Equity · Delivery") : PRODUCT_LABEL[r.product]}
              </span>
            </span>
          ),
        },
        ...(delivery ? [] : [{ key: "d", header: closed ? "Status" : "Direction", cell: (r: Row) => <DirectionLabel direction={r.direction} /> }]),
        ...(closed
          ? []
          : [
              { key: "q", header: "Qty", align: "right" as const, cell: (r: Row) => <QuantityDisplay value={r.quantity} /> },
              { key: "a", header: "Entry", align: "right" as const, cell: (r: Row) => <MoneyDisplay value={r.averageEntryPrice} dp={4} /> },
              {
                key: "p",
                header: "Last recorded price",
                align: "right" as const,
                cell: (r: Row) => (
                  <span className="flex flex-col items-end gap-1" title={r.priceAsOf ? `Price as of ${new Date(r.priceAsOf).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST` : (r.priceUnavailableReason ?? undefined)}>
                    <MoneyDisplay value={r.price} dp={4} />
                    <QualityBadge quality={r.priceQuality} stale={r.priceStale} />
                    {r.priceAsOf && (
                      <span className="whitespace-nowrap text-[11.5px] text-[var(--qf-ink-soft)]">
                        <DateDisplay value={r.priceAsOf} />
                      </span>
                    )}
                  </span>
                ),
              },
              { key: "v", header: "Value in fund", align: "right" as const, cell: (r: Row) => <MoneyDisplay value={r.marketValue} signed={r.direction === "SHORT"} /> },
              { key: "u", header: "Unrealized", align: "right" as const, cell: (r: Row) => <MoneyDisplay value={r.unrealizedPnl} signed /> },
            ]),
        { key: "r", header: "Realized", align: "right", cell: (r) => <MoneyDisplay value={r.realizedPnl} signed /> },
        { key: "c", header: "Charges", align: "right", hideOnMobile: true, cell: (r) => <MoneyDisplay value={r.chargesPaid} /> },
      ]}
    />
  );
}

export function HoldingsView() {
  const can = useCan();
  const res = usePoolResource<Holdings>("holdings");
  const state = resourceState(res, "positions");
  const [adding, setAdding] = useState(false);
  const [pricing, setPricing] = useState(false);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [category, setCategory] = useState<Category>("ALL");
  const h = res.data;

  const inCategory = (r: Row) => category === "ALL" || r.instrumentType === category;
  const open = (h?.rows ?? []).filter((r) => inCategory(r) && (filter === "ALL" || r.direction === filter));
  const holdings = open.filter((r) => r.product === "EQUITY_DELIVERY");
  const trading = open.filter((r) => r.product !== "EQUITY_DELIVERY");
  const closed = (h?.closed ?? []).filter(inCategory);

  return (
    <>
      <PageHeader
        title="Positions"
        description="Built from executed trades (average cost), per instrument and product. Delivery holdings are ownership; intraday, futures and options are trading positions. Prices are for display and labelled by quality; the official NAV uses only recorded closing prices."
        actions={
          <>
            {(can("trades:create") || can("watchlist:write")) && (
              <button type="button" className={btnSecondary} onClick={() => setAdding(true)}>
                Add instrument
              </button>
            )}
            {can("nav:finalize") && (
              <button type="button" className={btnPrimary} onClick={() => setPricing(true)}>
                Record price
              </button>
            )}
          </>
        }
      />
      {state ? (
        <SectionCard flush>{state}</SectionCard>
      ) : !h ? null : (
        <div className="space-y-6">
          <section aria-label="Position totals" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <FinancialMetric label="Value in fund" value={h.marketValue} hint={h.marketValue === null ? "Not shown: some prices are unavailable" : "Longs at market, short options as liabilities, intraday/futures at unrealized P&L"} />
            <FinancialMetric label="Unrealized P&L" value={h.unrealizedPnl} signed />
            <FinancialMetric label="Realized P&L" value={h.realizedPnl} signed hint="Net of all charges" />
            <FinancialMetric label="Trading charges" value={h.chargesPaid} />
          </section>
          {h.exposure && (h.rows.length > 0) && (
            <section aria-label="Exposure" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <FinancialMetric label="Long exposure" value={h.exposure.long} />
              <FinancialMetric label="Short exposure" value={h.exposure.short} />
              <FinancialMetric label="Gross exposure" value={h.exposure.gross} />
              <FinancialMetric label="Net exposure" value={h.exposure.net} signed hint="Notional; options at premium, not delta-adjusted" />
            </section>
          )}
          {(h.unpriced > 0 || h.stale > 0) && (
            <Disclaimer>
              {h.unpriced > 0 && `${h.unpriced} position(s) have no price available. `}
              {h.stale > 0 && `${h.stale} price(s) are stale: older than the last completed trading session. `}
              Missing or stale prices are never filled in or estimated.
            </Disclaimer>
          )}
          <div className="flex flex-wrap gap-6">
            <SegmentedField<Filter>
              label="Show"
              value={filter}
              onChange={setFilter}
              options={[
                { value: "ALL", label: "All" },
                { value: "LONG", label: "Long" },
                { value: "SHORT", label: "Short" },
                { value: "CLOSED", label: "Closed" },
              ]}
            />
            <SegmentedField<Category>
              label="Category"
              value={category}
              onChange={setCategory}
              options={[
                { value: "ALL", label: "All" },
                { value: "EQUITY", label: "Equity" },
                { value: "FUTURE", label: "Futures" },
                { value: "OPTION", label: "Options" },
              ]}
            />
          </div>
          {filter === "CLOSED" ? (
            <SectionCard title="Closed positions" flush>
              {closed.length === 0 ? <EmptyState title="No closed positions" description="A position appears here once it is fully closed." /> : <PositionsTable rows={closed} caption="Closed positions" closed />}
            </SectionCard>
          ) : (
            <>
              {(category === "ALL" || category === "EQUITY") && (
                <SectionCard title="Holdings (equity delivery)" flush>
                  {holdings.length === 0 ? (
                    <EmptyState title="No holdings" description="Delivery holdings appear once a delivery buy is executed." />
                  ) : (
                    <PositionsTable rows={holdings} caption="Equity delivery holdings" closed={false} delivery />
                  )}
                </SectionCard>
              )}
              <SectionCard title="Open trading positions" flush>
                {trading.length === 0 ? (
                  <EmptyState title="No open trading positions" description="Intraday, futures and options positions appear here while open." />
                ) : (
                  <PositionsTable rows={trading} caption="Open trading positions" closed={false} />
                )}
              </SectionCard>
            </>
          )}
        </div>
      )}
      <AddInstrument key={`a${adding}`} open={adding} onClose={() => setAdding(false)} />
      <RecordPrice key={`p${pricing}`} open={pricing} onClose={() => setPricing(false)} onDone={res.reload} />
    </>
  );
}
