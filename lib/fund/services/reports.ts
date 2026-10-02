// Read-only reports for one pool. Visibility follows the role:
//   * every member: official NAV history, the daily report (aggregates only
//     for other members' flows), their own statement, the tax estimate.
//   * MANAGER/ADMIN: per-member flow detail and any member's statement.
//   * ADMIN: the unofficial NAV preview used to strike the official NAV.
import { Money } from "@/lib/accounting/money";
import { TAX_DISCLAIMER, estimateTax, LONG_TERM_DAYS } from "@/lib/accounting/tax";
import { can, type FundContext } from "@/lib/fund/auth";
import { one, type Db } from "@/lib/fund/db";
import { notFoundError } from "@/lib/fund/errors";
import { latestOfficialNavs, memberPosition, type MemberPosition } from "@/lib/fund/queries";
import { getOfficialSnapshot, listNavHistory, previewNav, type NavPreview, type NavSnapshotRow } from "@/lib/fund/services/nav";
import { accountingRule } from "@/lib/fund/services/types";
import { ledgerStateNow, loadAccountingTrades, loadSettings } from "@/lib/fund/state";

const m = (s: string | null | undefined) => Money.fromDecimalString(s ?? "0");

export async function navHistoryReport(db: Db, ctx: FundContext, from: string | null, to: string | null) {
  const rows = await listNavHistory(db, ctx.fund.id, {
    from,
    to,
    includeSuperseded: can(ctx, "audit:view"),
    limit: 400,
  });
  return { rows };
}

type FlowRow = { id: number; memberId: number; memberName: string; amount: string; units: string; nav: string };

export type DailyReport = {
  date: string;
  official: NavSnapshotRow | null;
  /** ADMIN only: what the NAV would be if struck now. */
  preview: NavPreview | null;
  trades: Array<{ id: number; symbol: string; exchange: string; side: string; quantity: string; price: string; netValue: string; status: string }>;
  contributions: { count: number; total: string; units: string; rows: FlowRow[] | null };
  withdrawals: { count: number; total: string; units: string; rows: FlowRow[] | null };
  expenses: { count: number; total: string };
};

export async function dailyReport(db: Db, ctx: FundContext, date: string): Promise<DailyReport> {
  const fundId = ctx.fund.id;
  const detail = can(ctx, "contributions:view_all");
  const official = await getOfficialSnapshot(db, fundId, date);
  const preview = can(ctx, "nav:finalize") ? await previewNav(db, fundId, date) : null;

  const { rows: trades } = await db.query<{
    id: number; symbol: string; exchange: string; side: string; quantity: string; price: string; net_value: string; status: string;
  }>(
    `SELECT t.id, i.symbol, i.exchange, t.side, t.quantity::text AS quantity, t.price::text AS price,
            t.net_value::text AS net_value, t.status
       FROM qfinera_fund_trades t JOIN qfinera_fund_instruments i ON i.id = t.instrument_id
      WHERE t.fund_id = $1 AND t.trade_date = $2::date AND t.status IN ('EXECUTED', 'SETTLED', 'FINALIZED', 'REVERSED')
      ORDER BY t.id`,
    [fundId, date]
  );

  const flows = async (table: "qfinera_fund_contributions" | "qfinera_fund_withdrawals") => {
    const amountCol = table === "qfinera_fund_contributions" ? "x.amount" : "x.net_amount";
    const unitsCol = table === "qfinera_fund_contributions" ? "x.units_allocated" : "x.units_redeemed";
    const { rows } = await db.query<{ id: number; member_id: number; member_name: string; amount: string; units: string; nav: string }>(
      `SELECT x.id, x.member_id, u.display_name AS member_name, ${amountCol}::text AS amount,
              ${unitsCol}::text AS units, x.nav_used::text AS nav
         FROM ${table} x JOIN qfinance_users u ON u.id = x.member_id
        WHERE x.fund_id = $1 AND x.status = 'FINALIZED' AND x.effective_date = $2::date
        ORDER BY x.id`,
      [fundId, date]
    );
    const total = rows.reduce((s, r) => s.add(m(r.amount)), Money.zero());
    const units = rows.reduce((s, r) => s.add(m(r.units)), Money.zero());
    return {
      count: rows.length,
      total: total.toDecimalString(2),
      units: units.toDecimalString(4),
      // Other members' individual amounts are private: aggregates only for a MEMBER.
      rows: detail
        ? rows.map((r) => ({ id: r.id, memberId: r.member_id, memberName: r.member_name, amount: r.amount, units: r.units, nav: r.nav }))
        : null,
    };
  };

  const expenses = await one<{ n: number; total: string }>(
    db,
    `SELECT COUNT(*)::int AS n, COALESCE(SUM(amount), 0)::text AS total FROM qfinera_fund_expenses
      WHERE fund_id = $1 AND status = 'APPROVED' AND expense_date = $2::date`,
    [fundId, date]
  );

  return {
    date,
    official,
    preview,
    trades: trades.map((t) => ({
      id: t.id, symbol: t.symbol, exchange: t.exchange, side: t.side, quantity: t.quantity, price: t.price, netValue: t.net_value, status: t.status,
    })),
    contributions: await flows("qfinera_fund_contributions"),
    withdrawals: await flows("qfinera_fund_withdrawals"),
    expenses: { count: expenses?.n ?? 0, total: m(expenses?.total).toDecimalString(2) },
  };
}

export type StatementReport = {
  member: { userId: number; name: string };
  from: string | null;
  to: string | null;
  position: MemberPosition;
  latestNavDate: string | null;
  entries: Array<{ kind: "CONTRIBUTION" | "WITHDRAWAL"; id: number; date: string; amount: string; units: string; nav: string }>;
};

export async function memberStatement(
  db: Db,
  ctx: FundContext,
  memberId: number,
  from: string | null,
  to: string | null
): Promise<StatementReport> {
  // A member asking for someone else's statement gets "not found".
  if (memberId !== ctx.userId && !can(ctx, "members:view_all")) throw notFoundError("Member");
  const member = await one<{ display_name: string }>(
    db,
    `SELECT u.display_name FROM qfinera_fund_memberships mem JOIN qfinance_users u ON u.id = mem.user_id
      WHERE mem.fund_id = $1 AND mem.user_id = $2`,
    [ctx.fund.id, memberId]
  );
  if (!member) throw notFoundError("Member");

  const [navs, ledger] = await Promise.all([latestOfficialNavs(db, ctx.fund.id), ledgerStateNow(db, ctx.fund.id)]);
  const position = await memberPosition(db, ctx.fund.id, memberId, navs[0] ?? null, ledger.units);
  const { rows } = await db.query<{ kind: "CONTRIBUTION" | "WITHDRAWAL"; id: number; date: string; amount: string; units: string; nav: string }>(
    `SELECT 'CONTRIBUTION' AS kind, id, effective_date::text AS date, amount::text AS amount,
            units_allocated::text AS units, nav_used::text AS nav
       FROM qfinera_fund_contributions
      WHERE fund_id = $1 AND member_id = $2 AND status = 'FINALIZED'
        AND ($3::date IS NULL OR effective_date >= $3::date) AND ($4::date IS NULL OR effective_date <= $4::date)
     UNION ALL
     SELECT 'WITHDRAWAL', id, effective_date::text, net_amount::text, units_redeemed::text, nav_used::text
       FROM qfinera_fund_withdrawals
      WHERE fund_id = $1 AND member_id = $2 AND status = 'FINALIZED'
        AND ($3::date IS NULL OR effective_date >= $3::date) AND ($4::date IS NULL OR effective_date <= $4::date)
     ORDER BY date, kind, id`,
    [ctx.fund.id, memberId, from, to]
  );
  return {
    member: { userId: memberId, name: member.display_name },
    from,
    to,
    position,
    latestNavDate: navs[0]?.asOfDate ?? null,
    entries: rows,
  };
}

export async function taxReport(db: Db, ctx: FundContext, from: string | null, to: string | null) {
  const [trades, settings] = await Promise.all([loadAccountingTrades(db, ctx.fund.id), loadSettings(db, ctx.fund.id)]);
  const window = from && to ? { from, to } : undefined;
  const est = accountingRule(() => estimateTax(trades, settings.taxAssumptions, window));
  return {
    disclaimer: TAX_DISCLAIMER,
    method: `FIFO lots per instrument; holdings over ${LONG_TERM_DAYS} days are long-term. Buy charges add to cost, sell charges reduce proceeds. No set-off, carry-forward, exemption, surcharge or cess. Informational only; it never affects NAV or units.`,
    assumptions: settings.taxAssumptions,
    from,
    to,
    stcgGain: est.stcgGain.toDecimalString(2),
    ltcgGain: est.ltcgGain.toDecimalString(2),
    stcgTax: est.stcgTax.toDecimalString(2),
    ltcgTax: est.ltcgTax.toDecimalString(2),
    totalEstimatedTax: est.totalEstimatedTax.toDecimalString(2),
  };
}
