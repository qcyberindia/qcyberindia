"use client";

import { useState } from "react";
import { endpoints, listOf, type HoldingDto, type TradeDto } from "@/components/fund/api";
import { DateDisplay, MoneyDisplay, PercentDisplay, QualityBadge, QuantityDisplay } from "@/components/fund/display";
import { Drawer } from "@/components/fund/overlays";
import { EmptyState, PageHeader, SectionCard, btnSecondary } from "@/components/fund/parts";
import { useFundResource } from "@/components/fund/useResource";
import { recordHref } from "@/components/fund/nav";
import { resourceState } from "@/components/fund/common";
import { DataTable } from "@/components/fund/table";
import { DetailGrid } from "@/components/fund/workflow";
import { holdingColumns, tradeColumns } from "@/components/fund/views/columns";

function TransactionHistory({ instrumentId }: { instrumentId: number }) {
  const res = useFundResource(endpoints.trades, { instrument: instrumentId, pageSize: 50 }, (j) => listOf<TradeDto>(j));
  const state = resourceState(res, "transactions");
  return (
    <section aria-label="Transaction history" className="mt-6">
      <h3 className="mb-2 font-display text-[15px] font-semibold text-[var(--qf-ink)]">Transaction history</h3>
      {state ?? (res.data && res.data.items.length > 0 ? (
        <div className="-mx-4 border-t border-[var(--qf-line)]">
          <DataTable columns={tradeColumns(false)} rows={res.data.items} rowKey={(r) => r.id} rowHref={(r) => recordHref("trades", r.id)} caption="Transactions in this instrument" />
        </div>
      ) : (
        <EmptyState title="No transactions" description="Trades in this instrument appear here." />
      ))}
    </section>
  );
}

function HoldingDetail({ h }: { h: HoldingDto }) {
  return (
    <div className="px-5 py-4">
      <DetailGrid
        items={[
          { label: "Quantity", value: <QuantityDisplay value={h.quantity} /> },
          { label: "Average cost", value: <MoneyDisplay value={h.average_cost} dp={4} /> },
          { label: "Current price", value: <MoneyDisplay value={h.price} dp={4} /> },
          { label: "Price status", value: <QualityBadge quality={h.price_quality} /> },
          { label: "Price as of", value: <DateDisplay value={h.price_as_of} /> },
          { label: "Market value", value: <MoneyDisplay value={h.market_value} /> },
          { label: "Unrealized P&L", value: <MoneyDisplay value={h.unrealized_pnl} signed /> },
          { label: "Portfolio share", value: <PercentDisplay value={h.portfolio_percent} /> },
        ]}
      />
      {h.price_quality !== "LIVE" && h.price_quality !== "EOD" && (
        <p className="mt-4 rounded-md border border-[var(--qf-line)] bg-[var(--qf-cream-1)] px-3 py-2 text-[13px] text-[var(--qf-ink-soft)]">
          {h.price_quality === "UNAVAILABLE"
            ? "No price is available for this instrument, so market value and profit and loss cannot be shown."
            : "This price is not live. Market value and profit and loss reflect the price time shown above."}
        </p>
      )}
      <TransactionHistory instrumentId={h.instrument_id} />
    </div>
  );
}

export function HoldingsView() {
  const [selected, setSelected] = useState<HoldingDto | null>(null);
  const res = useFundResource(endpoints.holdings, {}, (j) => listOf<HoldingDto>(j));
  const state = resourceState(res, "holdings");
  const items = res.data?.items ?? [];
  const unavailable = items.filter((h) => h.price_quality === "UNAVAILABLE").length;
  const delayed = items.filter((h) => h.price_quality === "DELAYED" || h.price_quality === "MANUAL").length;

  return (
    <>
      <PageHeader title="Holdings" description="What the fund owns now, valued at the latest available price." />
      {(unavailable > 0 || delayed > 0) && (
        <div role="status" className="mb-4 rounded-md border border-[var(--qf-brass)]/50 bg-[var(--qf-brass)]/10 px-4 py-3 text-[13.5px] text-[var(--qf-ink)]">
          <p className="font-semibold">Some prices are not live</p>
          <p className="mt-0.5 text-[var(--qf-ink-soft)]">
            {unavailable > 0 && `${unavailable} holding${unavailable === 1 ? " has" : "s have"} no price, so its value is not shown. `}
            {delayed > 0 && `${delayed} ${delayed === 1 ? "price is" : "prices are"} delayed or manually entered, so check the price time before relying on it.`}
          </p>
        </div>
      )}
      <SectionCard flush>
        {state ?? (items.length > 0 ? (
          <DataTable
            columns={holdingColumns}
            rows={items}
            rowKey={(r) => r.instrument_id}
            caption="Fund holdings"
            rowAction={(r) => (
              <button type="button" className={btnSecondary} onClick={() => setSelected(r)} aria-label={`Details for ${r.symbol}`}>
                Details
              </button>
            )}
          />
        ) : (
          <EmptyState title="No holdings yet" description="Holdings appear once the fund records its first trade." />
        ))}
      </SectionCard>
      <Drawer open={selected !== null} onClose={() => setSelected(null)} title={selected?.symbol ?? "Instrument"} description={selected ? `${selected.name ?? selected.exchange} \u00B7 ${selected.exchange}` : undefined}>
        {selected && <HoldingDetail h={selected} />}
      </Drawer>
    </>
  );
}
