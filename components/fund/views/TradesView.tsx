"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Pencil, Plus } from "lucide-react";
import { apiFetch, errorMessage, poolApi, type InstrumentDto, type Paged, type Trade, type TradePreviewDto } from "@/components/fund/api";
import { isPositiveDecimal, resourceState } from "@/components/fund/common";
import { DateDisplay, MoneyDisplay, QuantityDisplay, StatusBadge } from "@/components/fund/display";
import { DecimalField, SegmentedField, TextAreaField, TextField, inputClass } from "@/components/fund/forms";
import { recordHref } from "@/components/fund/nav";
import { useNotice } from "@/components/fund/notices";
import { FormDialog } from "@/components/fund/overlays";
import { EmptyState, PageHeader, SectionCard, btnPrimary } from "@/components/fund/parts";
import { useCanAct, useFund } from "@/components/fund/session";
import { DataTable, FilterBar, FilterField, Pagination } from "@/components/fund/table";
import { usePoolMutation, usePoolResource } from "@/components/fund/useResource";
import {
  ACTION_LABEL,
  DirectionLabel,
  InstrumentPicker,
  PRODUCT_LABEL,
  SideLabel,
  instrumentLabel,
  todayIstInput,
} from "@/components/fund/views/shared";

/** One total, entered by the manager. QFinera does not calculate broker-specific charges. */
const CHARGES_HINT = "Your estimate, or the total from the contract note (brokerage, STT, exchange, GST, SEBI, stamp duty…). QFinera does not calculate broker charges.";

type Segment = "EQUITY" | "FUTURE" | "OPTION";
type Product = "EQUITY_DELIVERY" | "EQUITY_INTRADAY" | "FUTURES" | "OPTIONS";
type Action = "OPEN_LONG" | "OPEN_SHORT" | "CLOSE_LONG" | "CLOSE_SHORT";

const ACTIONS: ReadonlyArray<{ value: Action; label: string; side: "BUY" | "SELL" }> = [
  { value: "OPEN_LONG", label: "Open long", side: "BUY" },
  { value: "OPEN_SHORT", label: "Open short", side: "SELL" },
  { value: "CLOSE_LONG", label: "Close long", side: "SELL" },
  { value: "CLOSE_SHORT", label: "Close short", side: "BUY" },
];

function productFor(segment: Segment, equityProduct: Product): Product {
  return segment === "FUTURE" ? "FUTURES" : segment === "OPTION" ? "OPTIONS" : equityProduct;
}

/** Server-computed effect of the ticket (decimal strings; no browser arithmetic on money). */
function TicketPreview({ preview, closing }: { preview: TradePreviewDto; closing: boolean }) {
  const b = preview.before;
  return (
    <div className="space-y-3 rounded-md border border-[var(--qf-line)] bg-[var(--qf-cream-1)]/50 p-3 text-[13.5px]" aria-live="polite">
      {preview.problem && (
        <p role="alert" className="font-medium text-[var(--qf-down)]">
          This would be refused: {preview.problem}
        </p>
      )}
      <dl className="grid grid-cols-3 gap-3">
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-[var(--qf-ink-soft)]">Gross value</dt>
          <dd><MoneyDisplay value={preview.gross} /></dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-[var(--qf-ink-soft)]">Charges</dt>
          <dd><MoneyDisplay value={preview.totalCharges} /></dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-[var(--qf-ink-soft)]">Net cash impact</dt>
          <dd className="font-semibold"><MoneyDisplay value={preview.problem ? null : preview.cashImpact} signed /></dd>
        </div>
      </dl>
      {(closing || b.direction) && (
        <dl className="grid grid-cols-3 gap-3 border-t border-[var(--qf-line)] pt-3">
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-[var(--qf-ink-soft)]">Existing position</dt>
            <dd><DirectionLabel direction={b.direction} /></dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-[var(--qf-ink-soft)]">Current quantity</dt>
            <dd><QuantityDisplay value={b.quantity} /></dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-[var(--qf-ink-soft)]">Average entry</dt>
            <dd><MoneyDisplay value={b.averageEntryPrice} dp={4} /></dd>
          </div>
        </dl>
      )}
      {preview.after && (
        <p className="text-[13px] text-[var(--qf-ink-soft)]">
          After execution: <DirectionLabel direction={preview.after.direction} />
          {preview.after.direction ? <> <QuantityDisplay value={preview.after.quantity} /> @ <MoneyDisplay value={preview.after.averageEntryPrice} dp={4} /></> : null}
          {preview.realizedPnl !== null && (
            <>
              {" · "}Estimated realized P&amp;L <strong><MoneyDisplay value={preview.realizedPnl} signed /></strong>
            </>
          )}
        </p>
      )}
    </div>
  );
}

function NewTrade({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const can = useCanAct();
  const { poolId } = useFund();
  const { run, pending } = usePoolMutation();
  const { notify } = useNotice();
  const [segment, setSegment] = useState<Segment>("EQUITY");
  const [equityProduct, setEquityProduct] = useState<Product>("EQUITY_DELIVERY");
  const [action, setAction] = useState<Action>("OPEN_LONG");
  const [instrument, setInstrument] = useState<InstrumentDto | null>(null);
  const [tradeDate, setTradeDate] = useState(todayIstInput());
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [estimatedCharges, setEstimatedCharges] = useState("");
  const [externalRef, setExternalRef] = useState("");
  const [notes, setNotes] = useState("");
  const [execute, setExecute] = useState(true);
  const [backdateReason, setBackdateReason] = useState("");
  const [confirmBackdate, setConfirmBackdate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<TradePreviewDto | null>(null);

  const product = productFor(segment, equityProduct);
  const longOnly = product === "EQUITY_DELIVERY";
  const side = ACTIONS.find((a) => a.value === action)!.side;
  const chargeBody = { estimatedCharges: estimatedCharges.trim() || "0" };
  const chargesOk = !estimatedCharges.trim() || isPositiveDecimal(estimatedCharges.trim(), 2) || /^0+(\.0+)?$/.test(estimatedCharges.trim());
  const ticketReady = instrument !== null && isPositiveDecimal(quantity, 4) && isPositiveDecimal(price, 4) && chargesOk;
  const previewKey = ticketReady ? JSON.stringify([instrument!.id, product, action, tradeDate, quantity, price, chargeBody]) : "";

  useEffect(() => {
    if (!previewKey) return;
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      const [instrumentId, p, a, d, q, pr, ch] = JSON.parse(previewKey);
      apiFetch<{ preview: TradePreviewDto }>(poolApi(poolId, "trades/preview"), {
        body: { instrumentId, product: p, action: a, tradeDate: d, quantity: q, price: pr, ...ch },
        signal: ctrl.signal,
      })
        .then((r) => setPreview(r.preview))
        .catch(() => setPreview(null));
    }, 300);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [previewKey, poolId]);

  const chooseSegment = (s: Segment) => {
    setSegment(s);
    setInstrument(null);
    setPreview(null);
  };
  const chooseEquityProduct = (p: Product) => {
    setEquityProduct(p);
    if (p === "EQUITY_DELIVERY" && (action === "OPEN_SHORT" || action === "CLOSE_SHORT")) setAction("OPEN_LONG");
  };

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title="Trade ticket"
      description="Record an execution exactly as on the broker contract note. QFinera does not place orders. Executing moves the position and cash on the trade date; the official NAV is struck at end of day."
      submitLabel={execute ? "Record and execute" : "Save as draft"}
      pending={pending}
      error={error}
      onSubmit={async () => {
        setError(null);
        if (!instrument) return setError(segment === "EQUITY" ? "Choose an instrument." : "Choose a contract.");
        if (!isPositiveDecimal(quantity, 4) || !isPositiveDecimal(price, 4)) return setError("Quantity and price must be greater than zero (up to 4 decimals).");
        try {
          await run("trades", {
            instrumentId: instrument.id,
            product,
            action,
            side,
            tradeDate,
            quantity,
            price,
            ...chargeBody,
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
      <SegmentedField<Segment>
        label="Trade type"
        value={segment}
        onChange={chooseSegment}
        options={[
          { value: "EQUITY", label: "Equity" },
          { value: "FUTURE", label: "Futures" },
          { value: "OPTION", label: "Options" },
        ]}
      />
      {segment === "EQUITY" && (
        <SegmentedField<Product>
          label="Product"
          value={equityProduct}
          onChange={chooseEquityProduct}
          hint={equityProduct === "EQUITY_INTRADAY" ? "Mark-to-market: only charges move cash on open; the close settles the price difference. Square off before the day's NAV." : "Ownership: the full traded value moves cash."}
          options={[
            { value: "EQUITY_DELIVERY", label: "Delivery" },
            { value: "EQUITY_INTRADAY", label: "Intraday" },
          ]}
        />
      )}
      <SegmentedField<Action>
        label="Position"
        value={action}
        onChange={setAction}
        hint={`Side: ${side === "BUY" ? "Buy" : "Sell"} (set by the position action).`}
        options={ACTIONS.map((a) => ({
          value: a.value,
          label: a.label,
          disabled: longOnly && (a.value === "OPEN_SHORT" || a.value === "CLOSE_SHORT"),
          title: longOnly && a.value.endsWith("SHORT") ? "Equity delivery is long-only. Use intraday to short." : undefined,
        }))}
      />
      <InstrumentPicker key={segment} kind={segment} value={instrument} onChange={setInstrument} />
      <div className="grid gap-4 sm:grid-cols-3">
        <TextField label="Trade date" type="date" value={tradeDate} onChange={setTradeDate} required />
        <DecimalField label="Quantity" value={quantity} onChange={setQuantity} decimals={4} required hint={instrument?.lotSize && segment !== "EQUITY" ? `Units; lot size ${instrument.lotSize}.` : undefined} />
        <DecimalField label={segment === "OPTION" ? "Premium (₹)" : "Price (₹)"} value={price} onChange={setPrice} decimals={4} required />
      </div>
      <DecimalField label="Estimated charges (₹)" value={estimatedCharges} onChange={setEstimatedCharges} decimals={2} placeholder="0.00" hint={CHARGES_HINT} />
      {previewKey && preview && <TicketPreview preview={preview} closing={action.startsWith("CLOSE")} />}
      <TextField label="Contract note / broker reference" value={externalRef} onChange={setExternalRef} maxLength={64} hint="Optional. Prevents the same trade being entered twice." />
      <TextAreaField label="Notes" value={notes} onChange={setNotes} maxLength={1000} rows={2} />
      <label className="flex items-start gap-2 text-[13.5px]">
        <input type="checkbox" checked={execute} onChange={(e) => setExecute(e.target.checked)} className="mt-0.5 h-4 w-4" />
        Execute now (position and cash change on the trade date). Leave unticked to save a draft for review.
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
  const can = useCanAct();
  const { poolId } = useFund();
  const [status, setStatus] = useState(initialStatus);
  const [product, setProduct] = useState("");
  const [direction, setDirection] = useState("");
  const [phase, setPhase] = useState("");
  const [instrument, setInstrument] = useState<InstrumentDto | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const res = usePoolResource<Paged<"trades", Trade>>("trades", {
    status,
    product,
    direction,
    phase,
    instrument: instrument ? instrument.id : null,
    from,
    to,
    page,
  });
  const state = resourceState(res, "trades");
  const rows = res.data?.trades ?? [];
  const dirty = Boolean(status || product || direction || phase || instrument || from || to);
  const select = (id: string, value: string, set: (v: string) => void, options: ReadonlyArray<[string, string]>) => (
    <select id={id} className={inputClass} value={value} onChange={(e) => { set(e.target.value); setPage(1); }}>
      {options.map(([v, l]) => (
        <option key={v} value={v}>{l}</option>
      ))}
    </select>
  );

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
          setProduct("");
          setDirection("");
          setPhase("");
          setInstrument(null);
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
        <FilterField label="Product">
          {(id) =>
            select(id, product, setProduct, [
              ["", "All"],
              ["EQUITY_DELIVERY", "Equity · Delivery"],
              ["EQUITY_INTRADAY", "Equity · Intraday"],
              ["FUTURES", "Futures"],
              ["OPTIONS", "Options"],
            ])
          }
        </FilterField>
        <FilterField label="Direction">{(id) => select(id, direction, setDirection, [["", "Both"], ["LONG", "Long"], ["SHORT", "Short"]])}</FilterField>
        <FilterField label="Open / close">{(id) => select(id, phase, setPhase, [["", "Both"], ["OPEN", "Opening"], ["CLOSE", "Closing"]])}</FilterField>
        <FilterField label="From">{(id) => <input id={id} type="date" className={inputClass} value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />}</FilterField>
        <FilterField label="To">{(id) => <input id={id} type="date" className={inputClass} value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />}</FilterField>
        <div className="w-full sm:max-w-md">
          <InstrumentPicker
            key={instrument ? "set" : "unset"}
            kind={product === "FUTURES" ? "FUTURE" : product === "OPTIONS" ? "OPTION" : "EQUITY"}
            required={false}
            label="Filter by instrument"
            value={instrument}
            onChange={(i) => {
              setInstrument(i);
              setPage(1);
            }}
          />
        </div>
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
                  {
                    key: "i",
                    header: "Trade",
                    primary: true,
                    cell: (r) => (
                      <span className="md:whitespace-nowrap">
                        {instrumentLabel({ ...r, instrumentType: r.instrument_type, underlying: r.underlying_symbol, expiryDate: r.expiry_date, strikePrice: r.strike_price, optionType: r.option_type })}
                        <span className="ml-1.5 text-[12px] font-normal text-[var(--qf-ink-soft)]">#{r.id}</span>
                      </span>
                    ),
                  },
                  {
                    key: "pr",
                    header: "Product · position",
                    cell: (r) => (
                      <span className="whitespace-nowrap">
                        {PRODUCT_LABEL[r.product]}
                        <span className="block text-[12px] text-[var(--qf-ink-soft)]">
                          {ACTION_LABEL[r.position_action]} · <SideLabel side={r.side} />
                        </span>
                      </span>
                    ),
                  },
                  { key: "d", header: "Date", cell: (r) => <span className="whitespace-nowrap"><DateDisplay value={r.trade_date} /></span> },
                  {
                    key: "q",
                    header: "Qty @ price",
                    align: "right",
                    cell: (r) => (
                      <span className="whitespace-nowrap">
                        <QuantityDisplay value={r.quantity} /> <span className="text-[var(--qf-ink-soft)]">@</span> <MoneyDisplay value={r.price} dp={4} />
                      </span>
                    ),
                  },
                  { key: "n", header: "Net value", align: "right", hideOnMobile: true, cell: (r) => <span className="whitespace-nowrap"><MoneyDisplay value={r.net_value} /></span> },
                  {
                    key: "st",
                    header: "Status",
                    cell: (r) => (
                      <span className="flex flex-wrap items-center gap-1">
                        <StatusBadge status={r.status} label={r.is_backdated ? `${r.status.charAt(0) + r.status.slice(1).toLowerCase()} (backdated)` : undefined} />
                        {r.correction_count > 0 && <span className="text-[11.5px] text-[var(--qf-ink-soft)]" title="Corrected by an administrator; see the revision history">corrected</span>}
                      </span>
                    ),
                  },
                ]}
                rowAction={
                  can("trades:correct")
                    ? (r) =>
                        ["EXECUTED", "SETTLED", "FINALIZED"].includes(r.status) ? (
                          <Link
                            href={`${recordHref(poolId, "trades", r.id)}?edit=1`}
                            title="Edit trade (administrator correction)"
                            aria-label={`Edit trade #${r.id}`}
                            className="inline-flex h-10 min-w-10 items-center justify-center gap-1.5 rounded-md border border-[var(--qf-line)] px-2.5 text-[13px] font-semibold text-[var(--qf-ink)] hover:border-[var(--qf-brass)] hover:bg-[var(--qf-cream-1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--qf-brass)]"
                          >
                            <Pencil size={14} aria-hidden="true" />
                            <span className="md:sr-only">Edit</span>
                          </Link>
                        ) : null
                    : undefined
                }
              />
              <Pagination page={page} pageSize={res.data?.pageSize ?? 25} total={res.data?.total ?? null} count={rows.length} onPage={setPage} />
            </>
          ))}
      </SectionCard>
      {can("trades:create") && <NewTrade key={String(creating)} open={creating} onClose={() => setCreating(false)} onDone={res.reload} />}
    </>
  );
}
