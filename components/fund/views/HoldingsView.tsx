"use client";

import { useState } from "react";
import { errorMessage, type Holdings, type InstrumentDto } from "@/components/fund/api";
import { isPositiveDecimal, resourceState } from "@/components/fund/common";
import { DateDisplay, MoneyDisplay, PercentDisplay, QualityBadge, QuantityDisplay } from "@/components/fund/display";
import { DecimalField, SelectField, TextField } from "@/components/fund/forms";
import { useNotice } from "@/components/fund/notices";
import { FormDialog } from "@/components/fund/overlays";
import { Disclaimer, EmptyState, FinancialMetric, PageHeader, SectionCard, btnPrimary, btnSecondary } from "@/components/fund/parts";
import { useCan } from "@/components/fund/session";
import { DataTable } from "@/components/fund/table";
import { usePoolMutation, usePoolResource } from "@/components/fund/useResource";
import { InstrumentPicker, todayIstInput } from "@/components/fund/views/shared";

function AddInstrument({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { run, pending } = usePoolMutation();
  const { notify } = useNotice();
  const [symbol, setSymbol] = useState("");
  const [exchange, setExchange] = useState("NSE");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title="Add an instrument"
      description="Add an NSE or BSE listed instrument so trades and watchlist notes can refer to it."
      submitLabel="Add instrument"
      pending={pending}
      error={error}
      onSubmit={async () => {
        setError(null);
        try {
          await run("instruments", { symbol, exchange, name: name.trim() || undefined });
          notify("success", "Instrument added.");
          onClose();
        } catch (err) {
          setError(errorMessage(err));
        }
      }}
    >
      <TextField label="Exchange symbol" value={symbol} onChange={(v) => setSymbol(v.toUpperCase())} required maxLength={30} hint="As listed, e.g. INFY or M&M." />
      <SelectField label="Exchange" value={exchange} onChange={setExchange} options={[{ value: "NSE", label: "NSE" }, { value: "BSE", label: "BSE" }]} />
      <TextField label="Name" value={name} onChange={setName} maxLength={120} />
    </FormDialog>
  );
}

function RecordPrice({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const { run, pending } = usePoolMutation();
  const { notify } = useNotice();
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
      description="Closing (end-of-day) prices value holdings for the official NAV of that day. Prices are kept as history: a correction is a newer entry, never an edit."
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
      <InstrumentPicker value={instrument} onChange={setInstrument} />
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

export function HoldingsView() {
  const can = useCan();
  const res = usePoolResource<Holdings>("holdings");
  const state = resourceState(res, "holdings");
  const [adding, setAdding] = useState(false);
  const [pricing, setPricing] = useState(false);
  const h = res.data;

  return (
    <>
      <PageHeader
        title="Holdings"
        description="Positions from executed trades (average cost). Prices are for display and are labelled by quality; the official NAV uses only recorded closing prices."
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
          <section aria-label="Holdings totals" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <FinancialMetric label="Cost basis" value={h.costBasis} />
            <FinancialMetric label="Market value" value={h.marketValue} hint={h.marketValue === null ? "Not shown: some prices are unavailable" : undefined} />
            <FinancialMetric label="Unrealized P&L" value={h.unrealizedPnl} signed />
            <FinancialMetric label="Realized P&L" value={h.realizedPnl} signed />
          </section>
          {(h.unpriced > 0 || h.stale > 0) && (
            <Disclaimer>
              {h.unpriced > 0 && `${h.unpriced} holding(s) have no price available. `}
              {h.stale > 0 && `${h.stale} price(s) are stale: older than the last completed trading session. `}
              Missing or stale prices are never filled in or estimated.
            </Disclaimer>
          )}
          <SectionCard flush>
            {h.rows.length === 0 ? (
              <EmptyState title="No holdings" description="Holdings appear once a trade is executed." />
            ) : (
              <DataTable
                caption="Holdings"
                rows={h.rows}
                rowKey={(r) => r.instrumentId}
                columns={[
                  {
                    key: "s",
                    header: "Instrument",
                    primary: true,
                    cell: (r) => (
                      <span>
                        {r.symbol} · {r.exchange}
                        {r.name && <span className="block text-[12px] font-normal text-[var(--qf-ink-soft)]">{r.name}</span>}
                      </span>
                    ),
                  },
                  { key: "q", header: "Quantity", align: "right", cell: (r) => <QuantityDisplay value={r.quantity} /> },
                  { key: "a", header: "Average cost", align: "right", cell: (r) => <MoneyDisplay value={r.averageCost} dp={4} /> },
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
                  { key: "t", header: "Price as of", cell: (r) => (r.priceAsOf ? <DateDisplay value={r.priceAsOf} /> : <span className="text-[12.5px] text-[var(--qf-ink-soft)]">{r.priceUnavailableReason}</span>) },
                  { key: "v", header: "Market value", align: "right", cell: (r) => <MoneyDisplay value={r.marketValue} /> },
                  { key: "u", header: "Unrealized", align: "right", cell: (r) => <MoneyDisplay value={r.unrealizedPnl} signed /> },
                  { key: "w", header: "Weight", align: "right", hideOnMobile: true, cell: (r) => <PercentDisplay value={r.weight} /> },
                ]}
              />
            )}
          </SectionCard>
        </div>
      )}
      <AddInstrument key={`a${adding}`} open={adding} onClose={() => setAdding(false)} />
      <RecordPrice key={`p${pricing}`} open={pricing} onClose={() => setPricing(false)} onDone={res.reload} />
    </>
  );
}
