"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { errorMessage, type InstrumentDto, type Paged, type Trade } from "@/components/fund/api";
import { isPositiveDecimal, resourceState } from "@/components/fund/common";
import { DateDisplay, MoneyDisplay, QuantityDisplay, StatusBadge } from "@/components/fund/display";
import { DecimalField, SelectField, TextAreaField, TextField, inputClass } from "@/components/fund/forms";
import { recordHref } from "@/components/fund/nav";
import { useNotice } from "@/components/fund/notices";
import { FormDialog } from "@/components/fund/overlays";
import { EmptyState, PageHeader, SectionCard, btnPrimary } from "@/components/fund/parts";
import { useCan, useFund } from "@/components/fund/session";
import { DataTable, FilterBar, FilterField, Pagination } from "@/components/fund/table";
import { usePoolMutation, usePoolResource } from "@/components/fund/useResource";
import { InstrumentPicker, SideLabel, todayIstInput } from "@/components/fund/views/shared";

const CHARGES = [
  ["brokerage", "Brokerage"],
  ["stt", "STT"],
  ["gst", "GST"],
  ["stampDuty", "Stamp duty"],
  ["otherCharges", "Other charges"],
] as const;

function NewTrade({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const can = useCan();
  const { run, pending } = usePoolMutation();
  const { notify } = useNotice();
  const [instrument, setInstrument] = useState<InstrumentDto | null>(null);
  const [side, setSide] = useState("BUY");
  const [tradeDate, setTradeDate] = useState(todayIstInput());
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [charges, setCharges] = useState<Record<string, string>>({});
  const [externalRef, setExternalRef] = useState("");
  const [notes, setNotes] = useState("");
  const [execute, setExecute] = useState(true);
  const [backdateReason, setBackdateReason] = useState("");
  const [confirmBackdate, setConfirmBackdate] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title="Record a trade"
      description="Enter the trade exactly as on the broker contract note. Executing moves cash and holdings on the trade date; the official NAV is struck at end of day."
      submitLabel={execute ? "Record and execute" : "Save as draft"}
      pending={pending}
      error={error}
      onSubmit={async () => {
        setError(null);
        if (!instrument) return setError("Choose an instrument.");
        if (!isPositiveDecimal(quantity, 4) || !isPositiveDecimal(price, 4)) return setError("Quantity and price must be greater than zero (up to 4 decimals).");
        try {
          await run("trades", {
            instrumentId: instrument.id,
            side,
            tradeDate,
            quantity,
            price,
            ...Object.fromEntries(CHARGES.map(([k]) => [k, charges[k] || "0"])),
            externalRef: externalRef.trim() || undefined,
            notes: notes.trim() || undefined,
            execute,
            ...(backdateReason.trim() || confirmBackdate ? { backdateReason: backdateReason.trim(), confirmBackdate } : {}),
          });
          notify("success", execute ? "Trade executed." : "Draft saved.");
          onDone();
          onClose();
        } catch (err) {
          setError(errorMessage(err));
        }
      }}
    >
      <InstrumentPicker value={instrument} onChange={setInstrument} />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField label="Side" value={side} onChange={setSide} options={[{ value: "BUY", label: "Buy" }, { value: "SELL", label: "Sell" }]} />
        <TextField label="Trade date" type="date" value={tradeDate} onChange={setTradeDate} required />
        <DecimalField label="Quantity" value={quantity} onChange={setQuantity} decimals={4} required />
        <DecimalField label="Price (₹)" value={price} onChange={setPrice} decimals={4} required />
      </div>
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--qf-ink-soft)]">Charges from the contract note (₹)</legend>
        {CHARGES.map(([k, label]) => (
          <DecimalField key={k} label={label} value={charges[k] ?? ""} onChange={(v) => setCharges((c) => ({ ...c, [k]: v }))} decimals={2} placeholder="0.00" />
        ))}
      </fieldset>
      <TextField label="Contract note / broker reference" value={externalRef} onChange={setExternalRef} maxLength={64} hint="Optional. Prevents the same trade being entered twice." />
      <TextAreaField label="Notes" value={notes} onChange={setNotes} maxLength={1000} rows={2} />
      <label className="flex items-start gap-2 text-[13.5px]">
        <input type="checkbox" checked={execute} onChange={(e) => setExecute(e.target.checked)} className="mt-0.5 h-4 w-4" />
        Execute now (cash and holdings change on the trade date). Leave unticked to save a draft for review.
      </label>
      {can("trades:backdate") && execute && (
        <fieldset className="space-y-2 rounded-md border border-[var(--qf-line)] p-3">
          <legend className="px-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--qf-ink-soft)]">
            Administrator correction (only if dated on or before the latest official NAV)
          </legend>
          <TextField label="Correction reason" value={backdateReason} onChange={setBackdateReason} maxLength={500} />
          <label className="flex items-start gap-2 text-[13px]">
            <input type="checkbox" checked={confirmBackdate} onChange={(e) => setConfirmBackdate(e.target.checked)} className="mt-0.5 h-4 w-4" />
            I confirm this backdated trade. Official NAVs already struck are kept unchanged.
          </label>
        </fieldset>
      )}
    </FormDialog>
  );
}

export function TradesView({ initialStatus = "" }: { initialStatus?: string }) {
  const can = useCan();
  const { poolId } = useFund();
  const [status, setStatus] = useState(initialStatus);
  const [side, setSide] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const res = usePoolResource<Paged<"trades", Trade>>("trades", { status, side, from, to, page });
  const state = resourceState(res, "trades");
  const rows = res.data?.trades ?? [];
  const dirty = Boolean(status || side || from || to);

  return (
    <>
      <PageHeader
        title="Trades"
        description="Trades the pool placed at its own broker, recorded from contract notes. QFinera does not place orders."
        actions={
          can("trades:create") ? (
            <button type="button" className={btnPrimary} onClick={() => setCreating(true)}>
              <Plus size={16} aria-hidden="true" /> Record trade
            </button>
          ) : undefined
        }
      />
      <FilterBar
        dirty={dirty}
        onReset={() => {
          setStatus("");
          setSide("");
          setFrom("");
          setTo("");
          setPage(1);
        }}
      >
        <FilterField label="Status">
          {(id) => (
            <select id={id} className={inputClass} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
              <option value="">All</option>
              {(can("trades:create") ? ["DRAFT", "EXECUTED", "SETTLED", "CANCELLED", "REVERSED"] : ["EXECUTED", "SETTLED", "REVERSED"]).map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0) + s.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
          )}
        </FilterField>
        <FilterField label="Side">
          {(id) => (
            <select id={id} className={inputClass} value={side} onChange={(e) => { setSide(e.target.value); setPage(1); }}>
              <option value="">Both</option>
              <option value="BUY">Buy</option>
              <option value="SELL">Sell</option>
            </select>
          )}
        </FilterField>
        <FilterField label="From">{(id) => <input id={id} type="date" className={inputClass} value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />}</FilterField>
        <FilterField label="To">{(id) => <input id={id} type="date" className={inputClass} value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />}</FilterField>
      </FilterBar>
      <SectionCard flush>
        {state ??
          (rows.length === 0 ? (
            <EmptyState title="No trades" description={dirty ? "Nothing matches these filters." : "Trades appear here once recorded."} />
          ) : (
            <>
              <DataTable
                caption="Trades"
                rows={rows}
                rowKey={(r) => r.id}
                rowHref={(r) => recordHref(poolId, "trades", r.id)}
                columns={[
                  { key: "id", header: "Trade", primary: true, cell: (r) => `#${r.id}` },
                  { key: "i", header: "Instrument", cell: (r) => `${r.symbol} · ${r.exchange}` },
                  { key: "s", header: "Side", cell: (r) => <SideLabel side={r.side} /> },
                  { key: "d", header: "Trade date", cell: (r) => <DateDisplay value={r.trade_date} /> },
                  { key: "q", header: "Quantity", align: "right", cell: (r) => <QuantityDisplay value={r.quantity} /> },
                  { key: "p", header: "Price", align: "right", cell: (r) => <MoneyDisplay value={r.price} dp={4} /> },
                  { key: "n", header: "Net value", align: "right", cell: (r) => <MoneyDisplay value={r.net_value} /> },
                  { key: "st", header: "Status", cell: (r) => <StatusBadge status={r.status} label={r.is_backdated ? `${r.status.charAt(0) + r.status.slice(1).toLowerCase()} (backdated)` : undefined} /> },
                ]}
              />
              <Pagination page={page} pageSize={res.data?.pageSize ?? 25} total={res.data?.total ?? null} count={rows.length} onPage={setPage} />
            </>
          ))}
      </SectionCard>
      {can("trades:create") && <NewTrade key={String(creating)} open={creating} onClose={() => setCreating(false)} onDone={res.reload} />}
    </>
  );
}
