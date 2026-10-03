// Official end-of-day NAV for QFinera Fund.
//
//   previewNav   what the NAV for a date WOULD be, and what blocks it. Writes nothing.
//   strikeNav    ADMIN records the official NAV snapshot for a trading day,
//                then finalizes every contribution and withdrawal whose
//                applicable NAV date is that day.
//
// Rules:
//   * Basis (lib/fund/state.ts NAV_BASIS): the ledger before the date plus
//     that date's trades/expenses/adjustments; that date's contributions and
//     withdrawals are allocated AT this NAV, so they are not part of it.
//   * Holdings are valued ONLY at an EOD/MANUAL price recorded within that
//     IST date. A missing price blocks the NAV; a price is never guessed or
//     carried over from another day.
//   * Open positions are valued per product (lib/accounting/positions.ts
//     navValue): long delivery/options at market, short options as a
//     liability, intraday/futures at their unrealized price difference.
//   * An EQUITY_INTRADAY position still open at the end of the day blocks
//     the NAV: the square-off must be recorded first.
//   * Only a trading day, and only once its cutoff time has passed.
//   * Striking a date earlier than the latest official NAV, or correcting an
//     official NAV, is an ADMIN correction (reason + confirmation + audit).
//     A correction never rewrites history: the old snapshot is kept with
//     is_official = false and the new one gets a higher calculation_version.
//     A NAV that units were already allocated or redeemed at cannot be
//     corrected here (that needs an explicit ADJUSTMENT decision).
//   * One request that cannot be finalized (e.g. a withdrawal the Fund has
//     no cash for) does not block the NAV or the others: it is rolled back
//     to a savepoint, stays AWAITING_NAV and is reported back.
import { calculateNav } from "@/lib/accounting/nav";
import { navValue, type Direction, type Product } from "@/lib/accounting/positions";
import { InvariantError } from "@/lib/accounting/invariants";
import { Money } from "@/lib/accounting/money";
import { cutoffInstant, isTradingDay, type NavCutoffConfig } from "@/lib/accounting/nav-cutoff";
import { writeAudit } from "@/lib/fund/audit";
import { inTransaction, lockFund, one, type Db } from "@/lib/fund/db";
import { FundError, conflictError, validationError } from "@/lib/fund/errors";
import { assertPermission, hasPermission } from "@/lib/fund/rbac";
import {
  CONTRIBUTION_COLS,
  contributionNavDate,
  finalizeContributionInDb,
  type ContributionRecord,
} from "@/lib/fund/services/contributions";
import {
  WITHDRAWAL_COLS,
  finalizeWithdrawalInDb,
  type WithdrawalRecord,
} from "@/lib/fund/services/withdrawals";
import {
  MIN_BACKDATE_REASON,
  accountingRule,
  assertFundActive,
  todayIst,
  type NavSnapshotRef,
  type ServiceCtx,
} from "@/lib/fund/services/types";
import {
  latestOfficialNavDate,
  ledgerStateAsOf,
  loadOfficialPrices,
  loadPositions,
  loadSettings,
} from "@/lib/fund/state";

const m = (s: string | null | undefined) => Money.fromDecimalString(s ?? "0");

export type NavSnapshotRow = {
  id: number;
  asOfDate: string;
  nav: string;
  cash: string;
  holdingsValue: string;
  fundValue: string;
  outstandingUnits: string;
  calculationVersion: number;
  isOfficial: boolean;
  correctionReason: string | null;
  createdBy: number | null;
  createdAt: Date;
};

const SNAPSHOT_COLS = `id, as_of_date::text AS as_of_date, nav::text AS nav, cash::text AS cash,
  holdings_value::text AS holdings_value, fund_value::text AS fund_value,
  outstanding_units::text AS outstanding_units, calculation_version, is_official,
  correction_reason, created_by, created_at`;

type SnapshotDbRow = {
  id: number;
  as_of_date: string;
  nav: string;
  cash: string;
  holdings_value: string;
  fund_value: string;
  outstanding_units: string;
  calculation_version: number;
  is_official: boolean;
  correction_reason: string | null;
  created_by: number | null;
  created_at: Date;
};

function toSnapshot(r: SnapshotDbRow): NavSnapshotRow {
  return {
    id: r.id,
    asOfDate: r.as_of_date,
    nav: r.nav,
    cash: r.cash,
    holdingsValue: r.holdings_value,
    fundValue: r.fund_value,
    outstandingUnits: r.outstanding_units,
    calculationVersion: r.calculation_version,
    isOfficial: r.is_official,
    correctionReason: r.correction_reason,
    createdBy: r.created_by,
    createdAt: r.created_at,
  };
}

export async function getOfficialSnapshot(db: Db, fundId: number, date: string): Promise<NavSnapshotRow | null> {
  const row = await one<SnapshotDbRow>(
    db,
    `SELECT ${SNAPSHOT_COLS} FROM qfinera_fund_nav_snapshots WHERE fund_id = $1 AND as_of_date = $2::date AND is_official`,
    [fundId, date]
  );
  return row ? toSnapshot(row) : null;
}

/** NAV history, newest first. Superseded (corrected) versions only when asked. */
export async function listNavHistory(
  db: Db,
  fundId: number,
  opts: { from: string | null; to: string | null; includeSuperseded: boolean; limit: number }
): Promise<NavSnapshotRow[]> {
  const { rows } = await db.query<SnapshotDbRow>(
    `SELECT ${SNAPSHOT_COLS} FROM qfinera_fund_nav_snapshots
      WHERE fund_id = $1 AND ($2::date IS NULL OR as_of_date >= $2::date) AND ($3::date IS NULL OR as_of_date <= $3::date)
        AND ($4::boolean OR is_official)
      ORDER BY as_of_date DESC, calculation_version DESC
      LIMIT $5`,
    [fundId, opts.from, opts.to, opts.includeSuperseded, opts.limit]
  );
  return rows.map(toSnapshot);
}

// ---------------------------------------------------------------- compute

export type NavHoldingLine = {
  instrumentId: number;
  symbol: string;
  exchange: string;
  product: Product;
  direction: Direction;
  quantity: string;
  price: string | null;
  priceQuality: string | null;
  priceAsOf: string | null;
  value: string | null;
};

export type NavComputation = {
  date: string;
  cash: string;
  outstandingUnits: string;
  holdings: NavHoldingLine[];
  missingPrices: Array<{ instrumentId: number; symbol: string; exchange: string }>;
  /** Null when the NAV cannot be struck (see problems). */
  result: { holdingsValue: string; fundValue: string; nav: string } | null;
  problems: string[];
};

/** Computes (never stores) the NAV for `date` from the ledger and that day's official prices. */
export async function computeNav(db: Db, fundId: number, date: string, initialNav: Money): Promise<NavComputation> {
  const [ledger, positions] = await Promise.all([ledgerStateAsOf(db, fundId, date), loadPositions(db, fundId, date)]);
  const entries = [...positions.values()];
  const ids = [...new Set(entries.map((e) => e.instrumentId))];
  const [prices, instruments] = await Promise.all([
    loadOfficialPrices(db, fundId, ids, date),
    ids.length
      ? db.query<{ id: number; symbol: string; exchange: string }>(
          "SELECT id, symbol, exchange FROM qfinera_fund_instruments WHERE id = ANY($1::int[])",
          [ids]
        )
      : Promise.resolve({ rows: [] as Array<{ id: number; symbol: string; exchange: string }> }),
  ]);
  const byId = new Map(instruments.rows.map((i) => [i.id, i]));

  const holdings: NavHoldingLine[] = [];
  const missing: NavComputation["missingPrices"] = [];
  const openIntraday: string[] = [];
  for (const { instrumentId: id, product, position } of entries) {
    const inst = byId.get(id);
    const symbol = inst?.symbol ?? `#${id}`;
    const exchange = inst?.exchange ?? "-";
    const price = prices.get(id);
    if (!price && !missing.some((x) => x.instrumentId === id)) missing.push({ instrumentId: id, symbol, exchange });
    if (product === "EQUITY_INTRADAY") openIntraday.push(`${symbol} ${position.direction} ${position.quantity.toDecimalString(4)}`);
    holdings.push({
      instrumentId: id,
      symbol,
      exchange,
      product,
      direction: position.direction ?? "LONG",
      quantity: position.quantity.toDecimalString(4),
      price: price ? price.price.toDecimalString(4) : null,
      priceQuality: price?.quality ?? null,
      priceAsOf: price?.asOf ?? null,
      value: price ? navValue(position, product, price.price).toDecimalString(2) : null,
    });
  }
  holdings.sort((a, b) => a.symbol.localeCompare(b.symbol));

  const problems: string[] = [];
  if (missing.length > 0) {
    problems.push(
      `No end-of-day price is recorded for ${date} for: ${missing.map((x) => `${x.symbol} (${x.exchange})`).join(", ")}.`
    );
  }
  if (openIntraday.length > 0) {
    problems.push(
      `Intraday positions are still open on ${date}: ${openIntraday.join(", ")}. Record the square-off before striking the NAV.`
    );
  }
  if (ledger.cash.isNegative()) problems.push(`Cash on ${date} would be ${ledger.cash.toDecimalString(2)}.`);

  let result: NavComputation["result"] = null;
  if (problems.length === 0) {
    const nav = calculateNav({
      cash: ledger.cash,
      holdings: holdings.map((h) => ({ symbol: h.symbol, quantity: m(h.quantity), price: m(h.price), value: m(h.value) })),
      adjustments: Money.zero(), // ADJUSTMENT ledger entries are already part of cash
      outstandingUnits: ledger.units,
      initialNav,
    });
    result = {
      holdingsValue: nav.holdingsValue.toDecimalString(2),
      fundValue: nav.fundValue.toDecimalString(2),
      nav: nav.nav.toDecimalString(4),
    };
  }

  return {
    date,
    cash: ledger.cash.toDecimalString(2),
    outstandingUnits: ledger.units.toDecimalString(4),
    holdings,
    missingPrices: missing,
    result,
    problems,
  };
}

// ---------------------------------------------------------------- awaiting

async function awaitingContributions(db: Db, fundId: number, forUpdate: boolean): Promise<ContributionRecord[]> {
  const { rows } = await db.query<ContributionRecord>(
    `SELECT ${CONTRIBUTION_COLS} FROM qfinera_fund_contributions
      WHERE fund_id = $1 AND status = 'AWAITING_NAV'
      ORDER BY funds_confirmed_at, id ${forUpdate ? "FOR UPDATE" : ""}`,
    [fundId]
  );
  return rows;
}

async function awaitingWithdrawals(db: Db, fundId: number, forUpdate: boolean): Promise<WithdrawalRecord[]> {
  const { rows } = await db.query<WithdrawalRecord>(
    `SELECT ${WITHDRAWAL_COLS} FROM qfinera_fund_withdrawals
      WHERE fund_id = $1 AND status = 'AWAITING_NAV'
      ORDER BY approved_at, id ${forUpdate ? "FOR UPDATE" : ""}`,
    [fundId]
  );
  return rows;
}

export type AwaitingItem = { kind: "contribution" | "withdrawal"; id: number; memberId: number; navDate: string };

async function listAwaiting(db: Db, fundId: number, nav: NavCutoffConfig): Promise<AwaitingItem[]> {
  const [cs, ws] = await Promise.all([awaitingContributions(db, fundId, false), awaitingWithdrawals(db, fundId, false)]);
  const out: AwaitingItem[] = [];
  for (const c of cs) {
    const d = contributionNavDate(c, nav);
    if (d) out.push({ kind: "contribution", id: c.id, memberId: c.member_id, navDate: d });
  }
  for (const w of ws) if (w.effective_date) out.push({ kind: "withdrawal", id: w.id, memberId: w.member_id, navDate: w.effective_date });
  return out.sort((a, b) => (a.navDate === b.navDate ? a.id - b.id : a.navDate < b.navDate ? -1 : 1));
}

// ---------------------------------------------------------------- preview

export type NavPreview = NavComputation & {
  isTradingDay: boolean;
  cutoffPassed: boolean;
  cutoffAt: string;
  official: NavSnapshotRow | null;
  latestOfficialDate: string | null;
  /** True when striking this date would be an ADMIN correction. */
  requiresCorrection: boolean;
  /** Requests that will be finalized at this date's NAV. */
  dueOnDate: AwaitingItem[];
  /** Requests waiting for an EARLIER date whose NAV was never struck. */
  overdue: AwaitingItem[];
};

function navDateIssues(date: string, cfg: NavCutoffConfig, now: Date) {
  return {
    isTradingDay: isTradingDay(date, cfg.holidays),
    cutoffAt: cutoffInstant(date, cfg),
    cutoffPassed: now.getTime() >= cutoffInstant(date, cfg).getTime(),
  };
}

export async function previewNav(db: Db, fundId: number, date: string, now: Date = new Date()): Promise<NavPreview> {
  const [settings, fund, official, latest] = await Promise.all([
    loadSettings(db, fundId),
    one<{ initial_nav: string }>(db, "SELECT initial_nav::text AS initial_nav FROM qfinera_funds WHERE id = $1", [fundId]),
    getOfficialSnapshot(db, fundId, date),
    latestOfficialNavDate(db, fundId),
  ]);
  const computation = await computeNav(db, fundId, date, m(fund?.initial_nav ?? "10"));
  const issues = navDateIssues(date, settings.nav, now);
  const awaiting = await listAwaiting(db, fundId, settings.nav);

  const problems = [...computation.problems];
  if (!issues.isTradingDay) problems.unshift(`${date} is not a trading day.`);
  else if (!issues.cutoffPassed) problems.unshift(`The NAV cutoff for ${date} has not passed yet.`);

  return {
    ...computation,
    problems,
    isTradingDay: issues.isTradingDay,
    cutoffPassed: issues.cutoffPassed,
    cutoffAt: issues.cutoffAt.toISOString(),
    official,
    latestOfficialDate: latest,
    requiresCorrection: Boolean(official) || (latest !== null && date < latest),
    dueOnDate: awaiting.filter((a) => a.navDate === date),
    overdue: awaiting.filter((a) => a.navDate < date),
  };
}

// ---------------------------------------------------------------- strike

export type StrikeInput = {
  date: string;
  /** Required for a correction or an earlier (backdated) date. */
  correctionReason: string | null;
  confirmCorrection: boolean;
};

export type StrikeResult = {
  snapshot: NavSnapshotRow;
  corrected: NavSnapshotRow | null;
  finalized: { contributions: number[]; withdrawals: number[] };
  blocked: Array<{ kind: "contribution" | "withdrawal"; id: number; reason: string }>;
};

function blockReason(err: unknown): string | null {
  if (err instanceof FundError) return err.message;
  if (err instanceof InvariantError) return err.violations.map((v) => v.message).join("; ");
  return null;
}

export async function strikeNav(ctx: ServiceCtx, input: StrikeInput, now: Date = new Date()): Promise<StrikeResult> {
  assertPermission(ctx.actor, "nav:finalize");
  if (input.date > todayIst(now)) throw validationError("A NAV cannot be struck for a future date.", { date: "In the future" });

  return inTransaction(async (db) => {
    await lockFund(db, ctx.fundId);
    await assertFundActive(db, ctx.fundId);
    const settings = await loadSettings(db, ctx.fundId);
    const issues = navDateIssues(input.date, settings.nav, now);
    if (!issues.isTradingDay) throw conflictError(`${input.date} is not a trading day; no NAV is struck for it.`);
    if (!issues.cutoffPassed) {
      throw conflictError(`The NAV for ${input.date} can only be struck after its cutoff (${settings.nav.cutoffTimeIst} IST).`);
    }

    const existing = await getOfficialSnapshot(db, ctx.fundId, input.date);
    const latest = await latestOfficialNavDate(db, ctx.fundId);
    const isCorrection = Boolean(existing) || (latest !== null && input.date < latest);
    const reason = input.correctionReason?.trim() ?? "";

    if (isCorrection) {
      if (!hasPermission(ctx.actor, "corrections:backdate")) {
        throw new FundError("FORBIDDEN", "Only a fund administrator can correct or backdate a NAV.", 403);
      }
      if (reason.length < MIN_BACKDATE_REASON || !input.confirmCorrection) {
        throw validationError(
          existing
            ? `The NAV for ${input.date} is already official. To correct it, confirm and give a reason of at least ${MIN_BACKDATE_REASON} characters.`
            : `${input.date} is before the latest official NAV (${latest}). To strike it, confirm and give a reason of at least ${MIN_BACKDATE_REASON} characters.`,
          { correctionReason: "Reason and confirmation required" }
        );
      }
    }
    if (existing) {
      const used = await one<{ n: number }>(
        db,
        `SELECT ((SELECT COUNT(*) FROM qfinera_fund_contributions WHERE nav_snapshot_id = $1)
               + (SELECT COUNT(*) FROM qfinera_fund_withdrawals WHERE nav_snapshot_id = $1))::int AS n`,
        [existing.id]
      );
      if ((used?.n ?? 0) > 0) {
        throw conflictError(
          `Units were already allocated or redeemed at the ${input.date} NAV (${used?.n} request(s)). Finalized records are never changed; this NAV cannot be corrected here.`
        );
      }
    }

    const fund = await one<{ initial_nav: string }>(
      db,
      "SELECT initial_nav::text AS initial_nav FROM qfinera_funds WHERE id = $1",
      [ctx.fundId]
    );
    const computation = await computeNav(db, ctx.fundId, input.date, m(fund?.initial_nav ?? "10"));
    if (!computation.result) throw conflictError(computation.problems.join(" "));
    const result = computation.result;

    if (existing) {
      await db.query("UPDATE qfinera_fund_nav_snapshots SET is_official = false WHERE id = $1", [existing.id]);
    }
    const version = await one<{ v: number }>(
      db,
      `SELECT COALESCE(MAX(calculation_version), 0)::int + 1 AS v
         FROM qfinera_fund_nav_snapshots WHERE fund_id = $1 AND as_of_date = $2::date`,
      [ctx.fundId, input.date]
    );
    const inserted = await one<SnapshotDbRow>(
      db,
      `INSERT INTO qfinera_fund_nav_snapshots
         (fund_id, as_of_date, nav, cash, holdings_value, fund_value, outstanding_units,
          calculation_version, is_official, correction_reason, created_by)
       VALUES ($1, $2::date, $3, $4, $5, $6, $7, $8, true, $9, $10)
       RETURNING ${SNAPSHOT_COLS}`,
      [
        ctx.fundId,
        input.date,
        result.nav,
        computation.cash,
        result.holdingsValue,
        result.fundValue,
        computation.outstandingUnits,
        version?.v ?? 1,
        isCorrection ? reason : null,
        ctx.actor.userId,
      ]
    );
    if (!inserted) throw new Error("NAV snapshot insert returned no row");
    const snapshot = toSnapshot(inserted);

    await writeAudit(db, {
      fundId: ctx.fundId,
      userId: ctx.actor.userId,
      action: existing ? "nav.corrected" : isCorrection ? "nav.backdated" : "nav.struck",
      entityType: "nav_snapshot",
      entityId: snapshot.id,
      before: existing
        ? { as_of_date: existing.asOfDate, nav: existing.nav, fund_value: existing.fundValue, calculation_version: existing.calculationVersion }
        : null,
      after: {
        as_of_date: snapshot.asOfDate,
        nav: snapshot.nav,
        cash: snapshot.cash,
        holdings_value: snapshot.holdingsValue,
        fund_value: snapshot.fundValue,
        outstanding_units: snapshot.outstandingUnits,
        calculation_version: snapshot.calculationVersion,
        prices: computation.holdings.map((h) => ({
          symbol: h.symbol,
          product: h.product,
          direction: h.direction,
          quantity: h.quantity,
          price: h.price,
          value: h.value,
          as_of: h.priceAsOf,
        })),
      },
      reason: isCorrection ? reason : null,
      meta: ctx.meta,
    });

    // Finalize everything whose applicable NAV is this date, each in its own
    // savepoint so one infeasible request cannot block the rest.
    const ref: NavSnapshotRef = { id: snapshot.id, asOfDate: snapshot.asOfDate, nav: m(snapshot.nav) };
    const finalized: StrikeResult["finalized"] = { contributions: [], withdrawals: [] };
    const blocked: StrikeResult["blocked"] = [];

    const run = async (kind: "contribution" | "withdrawal", id: number, fn: () => Promise<unknown>) => {
      await db.query("SAVEPOINT qf_finalize");
      try {
        await fn();
        await db.query("RELEASE SAVEPOINT qf_finalize");
        finalized[kind === "contribution" ? "contributions" : "withdrawals"].push(id);
      } catch (err) {
        await db.query("ROLLBACK TO SAVEPOINT qf_finalize");
        const why = blockReason(err);
        if (why === null) throw err;
        blocked.push({ kind, id, reason: why });
      }
    };

    for (const c of await awaitingContributions(db, ctx.fundId, true)) {
      if (contributionNavDate(c, settings.nav) !== input.date) continue;
      await run("contribution", c.id, () => accountingRule(() => finalizeContributionInDb(db, ctx, c, ref)));
    }
    for (const w of await awaitingWithdrawals(db, ctx.fundId, true)) {
      if (w.effective_date !== input.date) continue;
      await run("withdrawal", w.id, () => finalizeWithdrawalInDb(db, ctx, w, ref));
    }

    return { snapshot, corrected: existing, finalized, blocked };
  });
}
