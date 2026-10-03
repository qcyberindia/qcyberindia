// Read models for the QFinera Fund UI and API. Everything here is a READ:
// authoritative accounting lives in lib/accounting + the services; these
// functions only load it and apply the caller's visibility (a MEMBER sees
// their own records, privileged roles see everyone's). Money and units
// leave this module as decimal strings.
import {
  averageEntryPrice,
  costBasis,
  exposure,
  navValue,
  notional as notionalOf,
  replayBook,
  unrealized,
  type BookEntry,
  type BookPosition,
  type Product,
} from "@/lib/accounting/positions";
import { Money } from "@/lib/accounting/money";
import { xirr, type DatedCashFlow } from "@/lib/accounting/xirr";
import { listAudit, loadEntityAudit, type AuditRecord } from "@/lib/fund/audit";
import { can, type FundContext } from "@/lib/fund/auth";
import { one, type Db } from "@/lib/fund/db";
import { notFoundError } from "@/lib/fund/errors";
import { memberValue, navChange, ownershipPercent, weightPercent } from "@/lib/fund/metrics";
import { canViewMemberRecord, hasPermission } from "@/lib/fund/rbac";
import {
  CONTRIBUTION_COLS,
  contributionNavDate,
  findOfficialNav,
  type ContributionRecord,
  type ContributionStatus,
} from "@/lib/fund/services/contributions";
import { listInstruments, marketStatus, quotesFor, type InstrumentType } from "@/lib/fund/services/market";
import { getMemberUnits, ledgerStateNow, loadAccountingTrades, loadSettings } from "@/lib/fund/state";

const m = (s: string | null | undefined) => Money.fromDecimalString(s ?? "0");

// ---------------------------------------------------------------- NAV

export type OfficialNav = {
  id: number;
  asOfDate: string;
  nav: string;
  cash: string;
  holdingsValue: string;
  fundValue: string;
  outstandingUnits: string;
};

/** The two most recent OFFICIAL NAV snapshots, newest first. */
export async function latestOfficialNavs(db: Db, fundId: number): Promise<OfficialNav[]> {
  const { rows } = await db.query<{
    id: number;
    as_of_date: string;
    nav: string;
    cash: string;
    holdings_value: string;
    fund_value: string;
    outstanding_units: string;
  }>(
    `SELECT id, as_of_date::text AS as_of_date, nav::text AS nav, cash::text AS cash,
            holdings_value::text AS holdings_value, fund_value::text AS fund_value,
            outstanding_units::text AS outstanding_units
       FROM qfinera_fund_nav_snapshots
      WHERE fund_id = $1 AND is_official
      ORDER BY as_of_date DESC, calculation_version DESC
      LIMIT 2`,
    [fundId]
  );
  return rows.map((r) => ({
    id: r.id,
    asOfDate: r.as_of_date,
    nav: r.nav,
    cash: r.cash,
    holdingsValue: r.holdings_value,
    fundValue: r.fund_value,
    outstandingUnits: r.outstanding_units,
  }));
}

// ----------------------------------------------------------- holdings

/**
 * One position: (instrument, product). Equity delivery rows are the
 * traditional holdings; intraday, futures and options rows are trading
 * positions. Values are decimal strings.
 */
export type HoldingRow = {
  instrumentId: number;
  symbol: string;
  exchange: string;
  name: string | null;
  instrumentType: InstrumentType;
  underlying: string | null;
  expiryDate: string | null;
  strikePrice: string | null;
  optionType: string | null;
  product: Product;
  /** LONG / SHORT; null for a closed position. */
  direction: "LONG" | "SHORT" | null;
  quantity: string;
  /** Average entry price (excl. charges), 4dp. */
  averageEntryPrice: string | null;
  /** Cost incl. capitalized opening charges / average cost per unit (legacy names). */
  averageCost: string | null;
  costBasis: string;
  realizedPnl: string;
  chargesPaid: string;
  /** From the market-data provider; null when unavailable. Display only, never accounting. */
  price: string | null;
  /** LIVE / DELAYED / EOD / MANUAL, or UNAVAILABLE. */
  priceQuality: string;
  priceAsOf: string | null;
  /** True when the price predates the last completed trading session. */
  priceStale: boolean;
  priceUnavailableReason: string | null;
  /** Absolute quantity x price (notional / premium value). */
  notional: string | null;
  /** Signed contribution to fund value (a short option is negative; MTM rows are their unrealized P&L). */
  marketValue: string | null;
  unrealizedPnl: string | null;
  /** Share of priced gross notional, only when every open position is priced. */
  weight: string | null;
};

export type HoldingsSummary = {
  /** Open positions. */
  rows: HoldingRow[];
  /** Positions that were traded and are now flat (realized P&L only). */
  closed: HoldingRow[];
  costBasis: string;
  /** Signed value of open positions in fund value. Null when any open position has no price. */
  marketValue: string | null;
  unrealizedPnl: string | null;
  /** Realized P&L across the fund's whole trade history, including closed positions. */
  realizedPnl: string;
  /** Charges on every executed trade. */
  chargesPaid: string;
  /** Notional exposure; null when any open position has no price. */
  exposure: { long: string; short: string; gross: string; net: string } | null;
  unpriced: number;
  stale: number;
};

export async function getHoldings(db: Db, fundId: number): Promise<HoldingsSummary> {
  const book = [...replayBook(await loadAccountingTrades(db, fundId)).values()];
  const realized = book.reduce((sum, e) => sum.add(e.position.realizedPnl), Money.zero());
  const charges = book.reduce((sum, e) => sum.add(e.position.chargesPaid), Money.zero());
  const ids = [...new Set(book.map((e) => e.instrumentId))];
  const instruments = ids.length ? await listInstruments(db, { q: null, exchange: null, ids, limit: 1000 }) : [];
  const byId = new Map(instruments.map((i) => [i.id, i]));
  const openEntries = book.filter((e) => !e.position.quantity.isZero());
  const quotes = await quotesFor(
    db,
    fundId,
    instruments.filter((i) => openEntries.some((e) => e.instrumentId === i.id))
  );

  let totalCost = Money.zero();
  let totalValue = Money.zero();
  let totalUnrealized = Money.zero();
  let unpriced = 0;
  let stale = 0;
  const priced: Array<{ position: BookPosition; price: Money | null }> = [];

  const toRow = (e: BookEntry): HoldingRow & { _notional: Money | null } => {
    const { position } = e;
    const open = !position.quantity.isZero();
    const instrument = byId.get(e.instrumentId);
    const quote = open ? quotes.get(e.instrumentId) : undefined;
    const price = quote?.available ? m(quote.price) : null;
    const cost = costBasis(position);
    const value = open && price ? navValue(position, e.product, price) : null;
    const pnl = open && price ? unrealized(position, price) : null;
    const notional = open && price ? notionalOf(position, price) : null;
    if (open) {
      totalCost = totalCost.add(cost);
      priced.push({ position, price });
      if (value && pnl) {
        totalValue = totalValue.add(value);
        totalUnrealized = totalUnrealized.add(pnl);
      } else unpriced += 1;
      if (quote?.available && quote.stale) stale += 1;
    }
    const avgEntry = averageEntryPrice(position);
    return {
      instrumentId: e.instrumentId,
      symbol: instrument?.symbol ?? `#${e.instrumentId}`,
      exchange: instrument?.exchange ?? "-",
      name: instrument?.name ?? null,
      instrumentType: instrument?.instrumentType ?? "EQUITY",
      underlying: instrument?.underlying ?? null,
      expiryDate: instrument?.expiryDate ?? null,
      strikePrice: instrument?.strikePrice ?? null,
      optionType: instrument?.optionType ?? null,
      product: e.product,
      direction: open ? position.direction : null,
      quantity: position.quantity.toDecimalString(4),
      averageEntryPrice: avgEntry?.toDecimalString(4) ?? null,
      averageCost: open ? cost.divide(position.quantity).round(4).toDecimalString(4) : null,
      costBasis: cost.toDecimalString(2),
      realizedPnl: position.realizedPnl.toDecimalString(2),
      chargesPaid: position.chargesPaid.toDecimalString(2),
      price: price ? price.toDecimalString(4) : null,
      priceQuality: open ? (quote?.quality ?? "UNAVAILABLE") : "UNAVAILABLE",
      priceAsOf: quote?.available ? quote.asOf : null,
      priceStale: quote?.available ? quote.stale : false,
      priceUnavailableReason: !open ? null : quote && !quote.available ? quote.reason : quote ? null : "No price source.",
      notional: notional ? notional.toDecimalString(2) : null,
      marketValue: value ? value.toDecimalString(2) : null,
      unrealizedPnl: pnl ? pnl.toDecimalString(2) : null,
      weight: null,
      _notional: notional,
    };
  };

  const staged = book.map(toRow);
  const exp = unpriced === 0 ? exposure(priced) : null;
  const strip = ({ _notional, ...row }: HoldingRow & { _notional: Money | null }): HoldingRow => ({
    ...row,
    weight: exp && _notional && !exp.gross.isZero() ? (weightPercent(_notional, exp.gross)?.toDecimalString(2) ?? null) : null,
  });
  const order = (a: HoldingRow, b: HoldingRow) => a.symbol.localeCompare(b.symbol) || a.product.localeCompare(b.product);
  const rows = staged.filter((r) => r.direction !== null).map(strip).sort(order);
  const closed = staged.filter((r) => r.direction === null).map(strip).sort(order);

  return {
    rows,
    closed,
    costBasis: totalCost.toDecimalString(2),
    marketValue: unpriced === 0 ? totalValue.toDecimalString(2) : null,
    unrealizedPnl: unpriced === 0 ? totalUnrealized.toDecimalString(2) : null,
    realizedPnl: realized.toDecimalString(2),
    chargesPaid: charges.toDecimalString(2),
    exposure: exp
      ? { long: exp.long.toDecimalString(2), short: exp.short.toDecimalString(2), gross: exp.gross.toDecimalString(2), net: exp.net.toDecimalString(2) }
      : null,
    unpriced,
    stale,
  };
}

// ---------------------------------------------------------- dashboard

export type DashboardData = {
  officialNav: OfficialNav | null;
  navChange: { absolute: string; percent: string | null; previousDate: string } | null;
  /** Ledger-derived, as of now. */
  ledger: { cash: string; units: string };
  /** Cash plus market value at the latest recorded prices; null if any holding is unpriced. */
  indicativeFundValue: string | null;
  memberCount: number;
  holdings: HoldingsSummary;
  /** Counts within the caller's visibility. draftTrades/expenses are null when not visible to the role. */
  pending: { contributions: number; withdrawals: number; draftTrades: number | null; expenses: number | null };
  /** Latest audit events; only for roles with audit:view, otherwise null. */
  recentActivity: AuditRecord[] | null;
  /** Calendar-based market session state (not an exchange feed). */
  market: { state: string; reason: string; basis: string } | null;
  recentTrades: Array<{
    id: number;
    symbol: string;
    exchange: string;
    side: string;
    quantity: string;
    price: string;
    tradeDate: string;
    status: string;
  }>;
  recentContributions: Array<{ id: number; memberName: string; amount: string; status: string; createdAt: Date }>;
  recentWithdrawals: Array<{
    id: number;
    memberName: string;
    requestType: string;
    requestedAmount: string | null;
    requestedUnits: string | null;
    status: string;
    createdAt: Date;
  }>;
  /** The signed-in member's own position. */
  me: {
    units: string;
    ownershipPercent: string | null;
    invested: string;
    currentValue: string | null;
    xirr: number | null;
  };
};

export async function getDashboard(db: Db, ctx: FundContext): Promise<DashboardData> {
  const fundId = ctx.fund.id;
  const ownContrib = can(ctx, "contributions:view_all") ? null : ctx.userId;
  const ownWithdraw = can(ctx, "withdrawals:view_all") ? null : ctx.userId;
  const seesDrafts = can(ctx, "trades:create");

  const [navs, ledger, holdings, memberCountRow, pendingRow] = await Promise.all([
    latestOfficialNavs(db, fundId),
    ledgerStateNow(db, fundId),
    getHoldings(db, fundId),
    one<{ n: number }>(
      db,
      "SELECT COUNT(*)::int AS n FROM qfinera_fund_memberships WHERE fund_id = $1 AND status = 'active'",
      [fundId]
    ),
    one<{ contributions: number; withdrawals: number }>(
      db,
      `SELECT
         (SELECT COUNT(*) FROM qfinera_fund_contributions
           WHERE fund_id = $1 AND status IN ('PENDING', 'APPROVED', 'AWAITING_NAV')
             AND ($2::int IS NULL OR member_id = $2))::int AS contributions,
         (SELECT COUNT(*) FROM qfinera_fund_withdrawals
           WHERE fund_id = $1 AND status IN ('REQUESTED', 'APPROVED', 'AWAITING_NAV')
             AND ($3::int IS NULL OR member_id = $3))::int AS withdrawals`,
      [fundId, ownContrib, ownWithdraw]
    ),
  ]);

  const [latest, previous] = [navs[0] ?? null, navs[1] ?? null];
  const change = latest && previous ? navChange(m(latest.nav), m(previous.nav)) : null;

  const { rows: trades } = await db.query<{
    id: number;
    symbol: string;
    exchange: string;
    side: string;
    quantity: string;
    price: string;
    trade_date: string;
    status: string;
  }>(
    `SELECT t.id, i.symbol, i.exchange, t.side, t.quantity::text AS quantity, t.price::text AS price,
            t.trade_date::text AS trade_date, t.status
       FROM qfinera_fund_trades t
       JOIN qfinera_fund_instruments i ON i.id = t.instrument_id
      WHERE t.fund_id = $1
        AND ($2::boolean OR t.status IN ('EXECUTED', 'SETTLED', 'FINALIZED', 'REVERSED'))
      ORDER BY t.trade_date DESC, t.id DESC
      LIMIT 5`,
    [fundId, seesDrafts]
  );

  const { rows: contributions } = await db.query<{
    id: number;
    member_name: string;
    amount: string;
    status: string;
    created_at: Date;
  }>(
    `SELECT c.id, u.display_name AS member_name, c.amount::text AS amount, c.status, c.created_at
       FROM qfinera_fund_contributions c
       JOIN qfinance_users u ON u.id = c.member_id
      WHERE c.fund_id = $1 AND ($2::int IS NULL OR c.member_id = $2)
      ORDER BY c.created_at DESC, c.id DESC
      LIMIT 5`,
    [fundId, ownContrib]
  );

  const { rows: withdrawals } = await db.query<{
    id: number;
    member_name: string;
    request_type: string;
    requested_amount: string | null;
    requested_units: string | null;
    status: string;
    created_at: Date;
  }>(
    `SELECT w.id, u.display_name AS member_name, w.request_type, w.requested_amount::text AS requested_amount,
            w.requested_units::text AS requested_units, w.status, w.created_at
       FROM qfinera_fund_withdrawals w
       JOIN qfinance_users u ON u.id = w.member_id
      WHERE w.fund_id = $1 AND ($2::int IS NULL OR w.member_id = $2)
      ORDER BY w.created_at DESC, w.id DESC
      LIMIT 5`,
    [fundId, ownWithdraw]
  );

  const me = await memberPosition(db, fundId, ctx.userId, latest, ledger.units);

  const privilegedCounts = await one<{ drafts: number; expenses: number }>(
    db,
    `SELECT (SELECT COUNT(*) FROM qfinera_fund_trades WHERE fund_id = $1 AND status = 'DRAFT')::int AS drafts,
            (SELECT COUNT(*) FROM qfinera_fund_expenses WHERE fund_id = $1 AND status = 'PENDING')::int AS expenses`,
    [fundId]
  );
  const recentActivity = can(ctx, "audit:view")
    ? (await listAudit(db, fundId, {
        entityType: null,
        entityId: null,
        action: null,
        userId: null,
        from: null,
        to: null,
        pageSize: 8,
        offset: 0,
      })).rows
    : null;
  const status = await marketStatus(db, fundId);

  return {
    officialNav: latest,
    navChange:
      change && previous
        ? {
            absolute: change.absolute.toDecimalString(4),
            percent: change.percent?.toDecimalString(2) ?? null,
            previousDate: previous.asOfDate,
          }
        : null,
    ledger: { cash: ledger.cash.toDecimalString(2), units: ledger.units.toDecimalString(4) },
    indicativeFundValue:
      holdings.marketValue !== null ? ledger.cash.add(m(holdings.marketValue)).toDecimalString(2) : null,
    memberCount: memberCountRow?.n ?? 0,
    holdings,
    pending: {
      contributions: pendingRow?.contributions ?? 0,
      withdrawals: pendingRow?.withdrawals ?? 0,
      draftTrades: seesDrafts ? (privilegedCounts?.drafts ?? 0) : null,
      expenses: can(ctx, "expenses:view") ? (privilegedCounts?.expenses ?? 0) : null,
    },
    recentActivity,
    market: status ? { state: status.state, reason: status.reason, basis: status.basis } : null,
    recentTrades: trades.map((t) => ({
      id: t.id,
      symbol: t.symbol,
      exchange: t.exchange,
      side: t.side,
      quantity: t.quantity,
      price: t.price,
      tradeDate: t.trade_date,
      status: t.status,
    })),
    recentContributions: contributions.map((c) => ({
      id: c.id,
      memberName: c.member_name,
      amount: c.amount,
      status: c.status,
      createdAt: c.created_at,
    })),
    recentWithdrawals: withdrawals.map((w) => ({
      id: w.id,
      memberName: w.member_name,
      requestType: w.request_type,
      requestedAmount: w.requested_amount,
      requestedUnits: w.requested_units,
      status: w.status,
      createdAt: w.created_at,
    })),
    me,
  };
}

export type MemberPosition = DashboardData["me"];

/** A member's units, ownership, invested capital, value at the latest official NAV, and XIRR (informational). */
export async function memberPosition(
  db: Db,
  fundId: number,
  memberId: number,
  latest: OfficialNav | null,
  fundUnits: Money
): Promise<MemberPosition> {
  const units = await getMemberUnits(db, fundId, memberId);

  const { rows: contributed } = await db.query<{ effective_date: string; amount: string }>(
    `SELECT effective_date::text AS effective_date, amount::text AS amount
       FROM qfinera_fund_contributions
      WHERE fund_id = $1 AND member_id = $2 AND status = 'FINALIZED'
      ORDER BY effective_date, id`,
    [fundId, memberId]
  );
  const { rows: withdrawn } = await db.query<{ effective_date: string; net_amount: string }>(
    `SELECT effective_date::text AS effective_date, net_amount::text AS net_amount
       FROM qfinera_fund_withdrawals
      WHERE fund_id = $1 AND member_id = $2 AND status = 'FINALIZED'
      ORDER BY effective_date, id`,
    [fundId, memberId]
  );

  const invested = contributed.reduce((sum, c) => sum.add(m(c.amount)), Money.zero());
  const value = memberValue(units, latest ? m(latest.nav) : null);

  // Contributions are negative flows, withdrawals positive, and the current
  // value is a positive terminal flow on the latest official NAV date.
  const flows: DatedCashFlow[] = [
    ...contributed.map((c) => ({ date: c.effective_date, amount: Money.zero().subtract(m(c.amount)) })),
    ...withdrawn.map((w) => ({ date: w.effective_date, amount: m(w.net_amount) })),
  ];
  if (latest && value && !value.isZero()) flows.push({ date: latest.asOfDate, amount: value });

  return {
    units: units.toDecimalString(4),
    ownershipPercent: ownershipPercent(units, fundUnits)?.toDecimalString(2) ?? null,
    invested: invested.toDecimalString(2),
    currentValue: value ? value.toDecimalString(2) : null,
    xirr: flows.length > 0 ? xirr(flows) : null,
  };
}

// ------------------------------------------------------ contributions

export type ContributionListRow = {
  id: number;
  memberId: number;
  memberName: string;
  amount: string;
  paymentDate: string;
  status: ContributionStatus;
  effectiveDate: string | null;
  navUsed: string | null;
  unitsAllocated: string | null;
  residual: string | null;
  createdAt: Date;
  fundsConfirmedAt: Date | null;
  finalizedAt: Date | null;
};

export async function listContributions(
  db: Db,
  ctx: FundContext,
  opts: { status: ContributionStatus | null; memberId: number | null; pageSize: number; offset: number }
): Promise<{ rows: ContributionListRow[]; total: number }> {
  // Visibility is decided HERE from the role, never from the request: a
  // member asking for someone else's records is silently scoped to their own.
  const memberId = can(ctx, "contributions:view_all") ? opts.memberId : ctx.userId;
  const where = `c.fund_id = $1 AND ($2::int IS NULL OR c.member_id = $2) AND ($3::text IS NULL OR c.status = $3)`;

  const count = await one<{ n: number }>(
    db,
    `SELECT COUNT(*)::int AS n FROM qfinera_fund_contributions c WHERE ${where}`,
    [ctx.fund.id, memberId, opts.status]
  );
  const { rows } = await db.query<{
    id: number;
    member_id: number;
    member_name: string;
    amount: string;
    payment_date: string;
    status: ContributionStatus;
    effective_date: string | null;
    nav_used: string | null;
    units_allocated: string | null;
    residual: string | null;
    created_at: Date;
    funds_confirmed_at: Date | null;
    finalized_at: Date | null;
  }>(
    `SELECT c.id, c.member_id, u.display_name AS member_name, c.amount::text AS amount,
            c.payment_date::text AS payment_date, c.status, c.effective_date::text AS effective_date,
            c.nav_used::text AS nav_used, c.units_allocated::text AS units_allocated,
            c.residual::text AS residual, c.created_at, c.funds_confirmed_at, c.finalized_at
       FROM qfinera_fund_contributions c
       JOIN qfinance_users u ON u.id = c.member_id
      WHERE ${where}
      ORDER BY c.created_at DESC, c.id DESC
      LIMIT $4 OFFSET $5`,
    [ctx.fund.id, memberId, opts.status, opts.pageSize, opts.offset]
  );

  return {
    total: count?.n ?? 0,
    rows: rows.map((r) => ({
      id: r.id,
      memberId: r.member_id,
      memberName: r.member_name,
      amount: r.amount,
      paymentDate: r.payment_date,
      status: r.status,
      effectiveDate: r.effective_date,
      navUsed: r.nav_used,
      unitsAllocated: r.units_allocated,
      residual: r.residual,
      createdAt: r.created_at,
      fundsConfirmedAt: r.funds_confirmed_at,
      finalizedAt: r.finalized_at,
    })),
  };
}

export type ContributionDetail = {
  contribution: ContributionRecord;
  memberName: string;
  /** For an AWAITING_NAV contribution: the NAV date that applies and whether it is official yet. */
  awaiting: { navDate: string; navOfficial: boolean } | null;
  audit: AuditRecord[] | null;
};

export async function getContributionDetail(db: Db, ctx: FundContext, id: number): Promise<ContributionDetail> {
  const row = await one<ContributionRecord>(
    db,
    `SELECT ${CONTRIBUTION_COLS} FROM qfinera_fund_contributions WHERE id = $1 AND fund_id = $2`,
    [id, ctx.fund.id]
  );
  // Another member's record (or another fund's) is indistinguishable from a missing one.
  if (!row || !canViewMemberRecord(ctx.actor, row.member_id, "contributions")) {
    throw notFoundError("Contribution");
  }

  const user = await one<{ display_name: string }>(db, "SELECT display_name FROM qfinance_users WHERE id = $1", [
    row.member_id,
  ]);

  let awaiting: ContributionDetail["awaiting"] = null;
  if (row.status === "AWAITING_NAV") {
    const settings = await loadSettings(db, ctx.fund.id);
    const navDate = contributionNavDate(row, settings.nav);
    if (navDate) awaiting = { navDate, navOfficial: Boolean(await findOfficialNav(db, ctx.fund.id, navDate)) };
  }

  const audit = hasPermission(ctx.actor, "audit:view")
    ? await loadEntityAudit(db, ctx.fund.id, "contribution", id)
    : null;

  return { contribution: row, memberName: user?.display_name ?? "Unknown member", awaiting, audit };
}

// ------------------------------------------------------------ members

export type MemberRow = {
  userId: number;
  name: string;
  /** Only for callers allowed to see every member. */
  email: string | null;
  role: string;
  status: string;
  joinedAt: Date;
  units: string;
  ownershipPercent: string | null;
  invested: string;
  currentValue: string | null;
};

export async function listMembers(db: Db, ctx: FundContext, opts: { includeRemoved?: boolean } = {}): Promise<MemberRow[]> {
  const seesAll = can(ctx, "members:view_all");
  const [ledger, navs] = await Promise.all([ledgerStateNow(db, ctx.fund.id), latestOfficialNavs(db, ctx.fund.id)]);
  const nav = navs[0] ? m(navs[0].nav) : null;

  const { rows } = await db.query<{
    user_id: number;
    display_name: string;
    email: string;
    role: string;
    status: string;
    joined_at: Date;
    units: string;
    invested: string;
  }>(
    `SELECT mem.user_id, u.display_name, u.email, mem.role, mem.status, mem.joined_at, mem.units::text AS units,
            COALESCE((SELECT SUM(c.amount) FROM qfinera_fund_contributions c
                       WHERE c.fund_id = mem.fund_id AND c.member_id = mem.user_id AND c.status = 'FINALIZED'), 0)::text AS invested
       FROM qfinera_fund_memberships mem
       JOIN qfinance_users u ON u.id = mem.user_id
      WHERE mem.fund_id = $1 AND ($2::int IS NULL OR mem.user_id = $2) AND ($3::boolean OR mem.status <> 'removed')
      ORDER BY CASE mem.role WHEN 'ADMIN' THEN 0 WHEN 'MANAGER' THEN 1 ELSE 2 END, u.display_name`,
    [ctx.fund.id, seesAll ? null : ctx.userId, Boolean(opts.includeRemoved && seesAll)]
  );

  return rows.map((r) => {
    const units = m(r.units);
    return {
      userId: r.user_id,
      name: r.display_name,
      email: seesAll ? r.email : null,
      role: r.role,
      status: r.status,
      joinedAt: r.joined_at,
      units: units.toDecimalString(4),
      ownershipPercent: ownershipPercent(units, ledger.units)?.toDecimalString(2) ?? null,
      invested: m(r.invested).toDecimalString(2),
      currentValue: memberValue(units, nav)?.toDecimalString(2) ?? null,
    };
  });
}
