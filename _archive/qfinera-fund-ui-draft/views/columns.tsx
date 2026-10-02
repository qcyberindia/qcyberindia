import type {
  ContributionDto,
  HoldingDto,
  MemberDto,
  TradeDto,
  WithdrawalDto,
} from "@/components/fund/api";
import { DateDisplay, MoneyDisplay, PercentDisplay, QualityBadge, QuantityDisplay, StatusBadge } from "@/components/fund/display";
import { humanize } from "@/components/fund/format";
import { memberLabel } from "@/components/fund/common";
import type { Column } from "@/components/fund/table";

/** Side is spelled out (Buy/Sell); colour only reinforces it. */
export function SideLabel({ side }: { side: "BUY" | "SELL" }) {
  return (
    <span className={`font-semibold ${side === "BUY" ? "text-[var(--qf-fix)]" : "text-[var(--qf-down)]"}`}>
      {side === "BUY" ? "Buy" : "Sell"}
    </span>
  );
}

export function contributionColumns(full: boolean): Column<ContributionDto>[] {
  const cols: Column<ContributionDto>[] = [
    { key: "id", header: "Contribution", primary: true, cell: (r) => `#${r.id}` },
    { key: "member", header: "Member", cell: (r) => memberLabel(null, r.member_id) },
    { key: "amount", header: "Amount", align: "right", cell: (r) => <MoneyDisplay value={r.amount} /> },
    { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
    { key: "requested", header: "Requested", cell: (r) => <DateDisplay value={r.created_at} /> },
    { key: "effective", header: "Effective date", cell: (r) => <DateDisplay value={r.effective_date} /> },
    { key: "units", header: "Units", align: "right", cell: (r) => <QuantityDisplay value={r.units_allocated} /> },
  ];
  if (!full) return cols.filter((c) => ["id", "amount", "status", "requested"].includes(c.key));
  cols.splice(
    5,
    0,
    { key: "confirmed", header: "Funds confirmed", cell: (r) => <DateDisplay value={r.funds_confirmed_at} /> },
  );
  cols.push(
    { key: "nav", header: "NAV used", align: "right", cell: (r) => <MoneyDisplay value={r.nav_used} dp={4} /> },
    { key: "residual", header: "Residual", align: "right", hideOnMobile: true, cell: (r) => <MoneyDisplay value={r.residual} dp={4} /> },
    { key: "finalized", header: "Finalized", hideOnMobile: true, cell: (r) => <DateDisplay value={r.finalized_at} /> }
  );
  return cols;
}

function WithdrawalRequested({ r }: { r: WithdrawalDto }) {
  return r.request_type === "AMOUNT" ? (
    <MoneyDisplay value={r.requested_amount} />
  ) : (
    <span>
      <QuantityDisplay value={r.requested_units} /> units
    </span>
  );
}

export function withdrawalColumns(full: boolean): Column<WithdrawalDto>[] {
  const cols: Column<WithdrawalDto>[] = [
    { key: "id", header: "Withdrawal", primary: true, cell: (r) => `#${r.id}` },
    { key: "member", header: "Member", cell: (r) => memberLabel(r.member_name, r.member_id) },
    { key: "type", header: "Type", cell: (r) => humanize(r.request_type) },
    { key: "requested", header: "Requested", align: "right", cell: (r) => <WithdrawalRequested r={r} /> },
    { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
    { key: "net", header: "Net payout", align: "right", cell: (r) => <MoneyDisplay value={r.net_amount} /> },
    { key: "created", header: "Requested on", cell: (r) => <DateDisplay value={r.created_at} /> },
  ];
  return full ? cols : cols.filter((c) => ["id", "requested", "status", "created"].includes(c.key));
}

export function tradeColumns(full: boolean): Column<TradeDto>[] {
  const cols: Column<TradeDto>[] = [
    { key: "id", header: "Trade", primary: true, cell: (r) => `#${r.id}` },
    { key: "instrument", header: "Instrument", cell: (r) => `${r.symbol} \u00B7 ${r.exchange}` },
    { key: "side", header: "Side", cell: (r) => <SideLabel side={r.side} /> },
    { key: "date", header: "Trade date", cell: (r) => <DateDisplay value={r.trade_date} /> },
    { key: "qty", header: "Quantity", align: "right", cell: (r) => <QuantityDisplay value={r.quantity} dp={4} /> },
    { key: "price", header: "Price", align: "right", cell: (r) => <MoneyDisplay value={r.price} dp={4} /> },
    { key: "net", header: "Net value", align: "right", cell: (r) => <MoneyDisplay value={r.net_value} /> },
    { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
  ];
  return full ? cols : cols.filter((c) => ["id", "instrument", "side", "net", "status"].includes(c.key));
}

export const holdingColumns: Column<HoldingDto>[] = [
  {
    key: "symbol",
    header: "Instrument",
    primary: true,
    cell: (r) => (
      <span>
        {r.symbol}
        <span className="block text-[12px] font-normal text-[var(--qf-ink-soft)]">{r.name ?? r.exchange}</span>
      </span>
    ),
  },
  { key: "qty", header: "Quantity", align: "right", cell: (r) => <QuantityDisplay value={r.quantity} /> },
  { key: "avg", header: "Average cost", align: "right", cell: (r) => <MoneyDisplay value={r.average_cost} dp={4} /> },
  {
    key: "price",
    header: "Current price",
    align: "right",
    cell: (r) => (
      <span className="flex flex-col items-end gap-1">
        <MoneyDisplay value={r.price} dp={4} />
        <QualityBadge quality={r.price_quality} />
      </span>
    ),
  },
  { key: "asof", header: "Price as of", cell: (r) => <DateDisplay value={r.price_as_of} /> },
  { key: "mv", header: "Market value", align: "right", cell: (r) => <MoneyDisplay value={r.market_value} /> },
  { key: "pnl", header: "Unrealized P&L", align: "right", cell: (r) => <MoneyDisplay value={r.unrealized_pnl} signed /> },
  { key: "pct", header: "Portfolio %", align: "right", cell: (r) => <PercentDisplay value={r.portfolio_percent} /> },
];

export const memberColumns: Column<MemberDto>[] = [
  { key: "name", header: "Member", primary: true, cell: (r) => r.display_name },
  { key: "role", header: "Role", cell: (r) => humanize(r.role) },
  { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
  { key: "joined", header: "Joined", cell: (r) => <DateDisplay value={r.joined_at} /> },
  { key: "capital", header: "Contributed", align: "right", cell: (r) => <MoneyDisplay value={r.contributed_capital} /> },
  { key: "units", header: "Units", align: "right", cell: (r) => <QuantityDisplay value={r.units} /> },
  { key: "value", header: "Current value", align: "right", cell: (r) => <MoneyDisplay value={r.current_value} /> },
  { key: "own", header: "Ownership", align: "right", cell: (r) => <PercentDisplay value={r.ownership_percent} /> },
];
