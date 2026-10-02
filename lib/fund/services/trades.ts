// Trade lifecycle (migration 008):
//
//   DRAFT -> EXECUTED -> SETTLED          (or DRAFT -> CANCELLED, EXECUTED/SETTLED -> REVERSED)
//
//   create    MANAGER/ADMIN records a trade from the broker contract note,
//             as a DRAFT (no accounting effect) or executed straight away.
//   execute   cash and holdings change ON THE TRADE DATE: a BUY/SELL ledger
//             entry is posted. Overselling and negative cash at any point
//             from the trade date onward are hard failures.
//   settle    informational: broker settlement confirmed.
//   cancel    a DRAFT that will not be executed.
//   reverse   ADMIN only, with a reason: a REVERSAL ledger entry dated the
//             day of the reversal undoes the cash effect; the original trade
//             and its ledger entry are kept unchanged.
//
// A trade dated on or before the latest official NAV is a backdated
// correction (ADMIN, reason, confirmation): see decideBackdate.
import { Money } from "@/lib/accounting/money";
import { replayPositions, type ReplayTrade } from "@/lib/accounting/portfolio";
import { computeTrade, type TradeComputation, type TradeSide } from "@/lib/accounting/trades";
import { loadEntityAudit, writeAudit, type AuditRecord } from "@/lib/fund/audit";
import { inTransaction, lockFund, one, type Db } from "@/lib/fund/db";
import { conflictError, notFoundError, validationError } from "@/lib/fund/errors";
import { postLedgerEntry } from "@/lib/fund/ledger-store";
import { assertPermission, hasPermission, type FundActor } from "@/lib/fund/rbac";
import { assertCashNeverNegativeFrom, loadAccountingTrades } from "@/lib/fund/state";
import {
  MIN_BACKDATE_REASON,
  accountingRule,
  assertFundActive,
  decideBackdate,
  isUniqueViolation,
  todayIst,
  type BackdateRequest,
  type ServiceCtx,
} from "@/lib/fund/services/types";

export type TradeStatus = "DRAFT" | "EXECUTED" | "SETTLED" | "CANCELLED" | "REVERSED" | "FINALIZED";
export const TRADE_STATUSES: readonly TradeStatus[] = ["DRAFT", "EXECUTED", "SETTLED", "CANCELLED", "REVERSED", "FINALIZED"];
/** Statuses whose cash and holdings effect is live. FINALIZED is the legacy 006 value. */
export const EFFECTIVE_TRADE_STATUSES: readonly TradeStatus[] = ["EXECUTED", "SETTLED", "FINALIZED"];

export type TradeRecord = {
  id: number;
  fund_id: number;
  instrument_id: number;
  symbol: string;
  exchange: string;
  instrument_name: string | null;
  trade_date: string;
  settlement_date: string | null;
  side: TradeSide;
  quantity: string;
  price: string;
  brokerage: string;
  stt: string;
  gst: string;
  stamp_duty: string;
  other_charges: string;
  net_value: string;
  status: TradeStatus;
  external_ref: string | null;
  notes: string | null;
  is_backdated: boolean;
  backdated_reason: string | null;
  reversal_reason: string | null;
  created_by: number;
  created_at: Date;
  executed_at: Date | null;
  settled_at: Date | null;
  reversed_at: Date | null;
};

const TRADE_SELECT = `
  SELECT t.id, t.fund_id, t.instrument_id, i.symbol, i.exchange, i.name AS instrument_name,
         t.trade_date::text AS trade_date, t.settlement_date::text AS settlement_date, t.side,
         t.quantity::text AS quantity, t.price::text AS price, t.brokerage::text AS brokerage, t.stt::text AS stt,
         t.gst::text AS gst, t.stamp_duty::text AS stamp_duty, t.other_charges::text AS other_charges,
         t.net_value::text AS net_value, t.status, t.external_ref, t.notes, t.is_backdated, t.backdated_reason,
         t.reversal_reason, t.created_by, t.created_at, t.executed_at, t.settled_at, t.reversed_at
    FROM qfinera_fund_trades t
    JOIN qfinera_fund_instruments i ON i.id = t.instrument_id`;

const m = (s: string | null | undefined) => Money.fromDecimalString(s ?? "0");

function auditState(t: TradeRecord): Record<string, unknown> {
  return {
    status: t.status,
    instrument: `${t.symbol}:${t.exchange}`,
    side: t.side,
    trade_date: t.trade_date,
    quantity: t.quantity,
    price: t.price,
    charges: {
      brokerage: t.brokerage,
      stt: t.stt,
      gst: t.gst,
      stamp_duty: t.stamp_duty,
      other_charges: t.other_charges,
    },
    net_value: t.net_value,
    external_ref: t.external_ref,
    is_backdated: t.is_backdated,
  };
}

async function loadTrade(db: Db, fundId: number, id: number, forUpdate = false): Promise<TradeRecord> {
  if (forUpdate) {
    // Row lock on the trade itself (the join can't be locked with FOR UPDATE OF i).
    await db.query("SELECT id FROM qfinera_fund_trades WHERE id = $1 AND fund_id = $2 FOR UPDATE", [id, fundId]);
  }
  const row = await one<TradeRecord>(db, `${TRADE_SELECT} WHERE t.id = $1 AND t.fund_id = $2`, [id, fundId]);
  if (!row) throw notFoundError("Trade");
  return row;
}

export function tradeComputation(t: Pick<TradeRecord, "side" | "quantity" | "price" | "brokerage" | "stt" | "gst" | "stamp_duty" | "other_charges">): TradeComputation {
  return accountingRule(() =>
    computeTrade({
      side: t.side,
      quantity: m(t.quantity),
      price: m(t.price),
      charges: {
        brokerage: m(t.brokerage),
        stt: m(t.stt),
        gst: m(t.gst),
        stampDuty: m(t.stamp_duty),
        otherCharges: m(t.other_charges),
      },
    })
  );
}

function asReplay(t: TradeRecord): ReplayTrade {
  const c = tradeComputation(t);
  return {
    id: t.id,
    instrumentId: t.instrument_id,
    tradeDate: t.trade_date,
    side: t.side,
    quantity: m(t.quantity),
    price: m(t.price),
    charges: c.totalCharges,
  };
}

/** Throws a 409 naming the instrument if the trade history would oversell it. */
function assertNoOversell(trades: readonly ReplayTrade[], symbols: Map<number, string>): void {
  const byInstrument = new Map<number, ReplayTrade[]>();
  for (const t of trades) byInstrument.set(t.instrumentId, [...(byInstrument.get(t.instrumentId) ?? []), t]);
  for (const [instrumentId, list] of byInstrument) {
    try {
      replayPositions(list);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "not enough held";
      throw conflictError(`This would oversell ${symbols.get(instrumentId) ?? `instrument #${instrumentId}`}: ${msg}.`);
    }
  }
}

// ---------------------------------------------------------------- create

export type CreateTradeInput = {
  instrumentId: number;
  side: TradeSide;
  tradeDate: string;
  settlementDate: string | null;
  quantity: Money;
  price: Money;
  charges: { brokerage: Money; stt: Money; gst: Money; stampDuty: Money; otherCharges: Money };
  externalRef: string | null;
  notes: string | null;
  execute: boolean;
  backdate: BackdateRequest | null;
};

export async function createTrade(ctx: ServiceCtx, input: CreateTradeInput, now: Date = new Date()): Promise<TradeRecord> {
  assertPermission(ctx.actor, "trades:create");
  if (input.tradeDate > todayIst(now)) {
    throw validationError("The trade date cannot be in the future.", { tradeDate: "In the future" });
  }
  if (input.settlementDate && input.settlementDate < input.tradeDate) {
    throw validationError("Settlement cannot be before the trade date.", { settlementDate: "Before trade date" });
  }
  const computation = accountingRule(() =>
    computeTrade({ side: input.side, quantity: input.quantity, price: input.price, charges: input.charges })
  );
  if (computation.net.compare(Money.zero()) <= 0) {
    throw validationError("Charges cannot be equal to or more than the sale value.", { otherCharges: "Too high" });
  }

  try {
    return await inTransaction(async (db) => {
      await lockFund(db, ctx.fundId);
      await assertFundActive(db, ctx.fundId);
      const instrument = await one<{ id: number }>(db, "SELECT id FROM qfinera_fund_instruments WHERE id = $1", [
        input.instrumentId,
      ]);
      if (!instrument) throw validationError("Choose a valid instrument.", { instrumentId: "Unknown instrument" });

      const inserted = await one<{ id: number }>(
        db,
        `INSERT INTO qfinera_fund_trades
           (fund_id, instrument_id, trade_date, settlement_date, side, quantity, price, brokerage, stt, gst,
            stamp_duty, other_charges, net_value, status, external_ref, notes, created_by)
         VALUES ($1, $2, $3::date, $4::date, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'DRAFT', $14, $15, $16)
         RETURNING id`,
        [
          ctx.fundId,
          input.instrumentId,
          input.tradeDate,
          input.settlementDate,
          input.side,
          input.quantity.toDecimalString(4),
          input.price.toDecimalString(4),
          input.charges.brokerage.toDecimalString(2),
          input.charges.stt.toDecimalString(2),
          input.charges.gst.toDecimalString(2),
          input.charges.stampDuty.toDecimalString(2),
          input.charges.otherCharges.toDecimalString(2),
          computation.net.toDecimalString(2),
          input.externalRef,
          input.notes,
          ctx.actor.userId,
        ]
      );
      if (!inserted) throw new Error("trade insert returned no row");
      const draft = await loadTrade(db, ctx.fundId, inserted.id);
      await writeAudit(db, {
        fundId: ctx.fundId,
        userId: ctx.actor.userId,
        action: "trade.created",
        entityType: "trade",
        entityId: draft.id,
        after: auditState(draft),
        meta: ctx.meta,
      });
      return input.execute ? executeInDb(db, ctx, draft, input.backdate) : draft;
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw conflictError("A trade with this broker reference already exists in this fund.");
    throw err;
  }
}

async function executeInDb(db: Db, ctx: ServiceCtx, draft: TradeRecord, backdateRequest: BackdateRequest | null): Promise<TradeRecord> {
  if (draft.status !== "DRAFT") {
    throw conflictError(`Only a DRAFT trade can be executed (this one is ${draft.status}).`);
  }
  const backdate = await decideBackdate(db, ctx, draft.trade_date, backdateRequest);
  if (backdate.isBackdated) assertPermission(ctx.actor, "trades:backdate");

  const computation = tradeComputation(draft);
  const history = await loadAccountingTrades(db, ctx.fundId);
  assertNoOversell([...history, asReplay(draft)], new Map([[draft.instrument_id, draft.symbol]]));

  await postLedgerEntry(db, {
    fundId: ctx.fundId,
    memberId: null,
    entryType: draft.side,
    referenceTable: "qfinera_fund_trades",
    referenceId: draft.id,
    entryDate: draft.trade_date,
    cashDelta: computation.cashDelta,
    unitsDelta: Money.zero(),
    description: `${draft.side === "BUY" ? "Buy" : "Sell"} ${draft.quantity} ${draft.symbol} @ ${draft.price}`,
    isBackdated: backdate.isBackdated,
    backdatedReason: backdate.reason,
    createdBy: ctx.actor.userId,
  });
  await db.query(
    `UPDATE qfinera_fund_trades
        SET status = 'EXECUTED', executed_at = now(), executed_by = $3, is_backdated = $4, backdated_reason = $5,
            updated_at = now()
      WHERE id = $1 AND fund_id = $2`,
    [draft.id, ctx.fundId, ctx.actor.userId, backdate.isBackdated, backdate.reason]
  );
  // Negative cash is a hard fail at ANY point from the trade date onward.
  await assertCashNeverNegativeFrom(db, ctx.fundId, draft.trade_date);

  const after = await loadTrade(db, ctx.fundId, draft.id);
  await writeAudit(db, {
    fundId: ctx.fundId,
    userId: ctx.actor.userId,
    action: backdate.isBackdated ? "trade.executed_backdated" : "trade.executed",
    entityType: "trade",
    entityId: draft.id,
    before: auditState(draft),
    after: auditState(after),
    reason: backdate.reason,
    meta: ctx.meta,
  });
  return after;
}

export async function executeTrade(ctx: ServiceCtx, id: number, backdate: BackdateRequest | null): Promise<TradeRecord> {
  assertPermission(ctx.actor, "trades:create");
  return inTransaction(async (db) => {
    await lockFund(db, ctx.fundId);
    await assertFundActive(db, ctx.fundId);
    return executeInDb(db, ctx, await loadTrade(db, ctx.fundId, id, true), backdate);
  });
}

export async function cancelDraftTrade(ctx: ServiceCtx, id: number, reason: string | null): Promise<TradeRecord> {
  assertPermission(ctx.actor, "trades:create");
  return inTransaction(async (db) => {
    await lockFund(db, ctx.fundId);
    const before = await loadTrade(db, ctx.fundId, id, true);
    if (before.status !== "DRAFT") {
      throw conflictError(`Only a DRAFT trade can be cancelled (this one is ${before.status}). Executed trades are reversed instead.`);
    }
    await db.query(
      "UPDATE qfinera_fund_trades SET status = 'CANCELLED', updated_at = now() WHERE id = $1 AND fund_id = $2",
      [id, ctx.fundId]
    );
    const after = await loadTrade(db, ctx.fundId, id);
    await writeAudit(db, {
      fundId: ctx.fundId,
      userId: ctx.actor.userId,
      action: "trade.cancelled",
      entityType: "trade",
      entityId: id,
      before: auditState(before),
      after: auditState(after),
      reason,
      meta: ctx.meta,
    });
    return after;
  });
}

export async function settleTrade(ctx: ServiceCtx, id: number, settlementDate: string | null): Promise<TradeRecord> {
  assertPermission(ctx.actor, "trades:create");
  return inTransaction(async (db) => {
    await lockFund(db, ctx.fundId);
    const before = await loadTrade(db, ctx.fundId, id, true);
    if (before.status !== "EXECUTED" && before.status !== "FINALIZED") {
      throw conflictError(`Only an executed trade can be marked settled (this one is ${before.status}).`);
    }
    const date = settlementDate ?? before.settlement_date;
    if (date && date < before.trade_date) {
      throw validationError("Settlement cannot be before the trade date.", { settlementDate: "Before trade date" });
    }
    await db.query(
      `UPDATE qfinera_fund_trades
          SET status = 'SETTLED', settled_at = now(), settled_by = $3, settlement_date = $4::date, updated_at = now()
        WHERE id = $1 AND fund_id = $2`,
      [id, ctx.fundId, ctx.actor.userId, date]
    );
    const after = await loadTrade(db, ctx.fundId, id);
    await writeAudit(db, {
      fundId: ctx.fundId,
      userId: ctx.actor.userId,
      action: "trade.settled",
      entityType: "trade",
      entityId: id,
      before: { ...auditState(before), settlement_date: before.settlement_date },
      after: { ...auditState(after), settlement_date: after.settlement_date },
      meta: ctx.meta,
    });
    return after;
  });
}

/** ADMIN: undo an executed trade's cash effect with a REVERSAL entry dated today. */
export async function reverseTrade(
  ctx: ServiceCtx,
  id: number,
  input: { reason: string; confirmed: boolean },
  now: Date = new Date()
): Promise<TradeRecord> {
  assertPermission(ctx.actor, "trades:reverse");
  if (input.reason.trim().length < MIN_BACKDATE_REASON || !input.confirmed) {
    throw validationError(
      `Confirm the reversal and give a reason of at least ${MIN_BACKDATE_REASON} characters.`,
      { reason: "Reason and confirmation required" }
    );
  }
  return inTransaction(async (db) => {
    await lockFund(db, ctx.fundId);
    const before = await loadTrade(db, ctx.fundId, id, true);
    if (!EFFECTIVE_TRADE_STATUSES.includes(before.status)) {
      throw conflictError(`Only an executed or settled trade can be reversed (this one is ${before.status}).`);
    }
    const posting = await one<{ cash_delta: string }>(
      db,
      `SELECT cash_delta::text AS cash_delta FROM qfinera_fund_ledger_entries
        WHERE reference_table = 'qfinera_fund_trades' AND reference_id = $1 AND entry_type IN ('BUY', 'SELL')`,
      [id]
    );
    if (!posting) throw conflictError("This trade has no ledger posting to reverse.");

    const effective = todayIst(now);
    const backdate = await decideBackdate(db, ctx, effective, { reason: input.reason, confirmed: input.confirmed });

    const remaining = (await loadAccountingTrades(db, ctx.fundId)).filter((t) => t.id !== id);
    assertNoOversell(remaining, new Map([[before.instrument_id, before.symbol]]));

    await postLedgerEntry(db, {
      fundId: ctx.fundId,
      memberId: null,
      entryType: "REVERSAL",
      referenceTable: "qfinera_fund_trades",
      referenceId: id,
      entryDate: effective,
      cashDelta: Money.zero().subtract(m(posting.cash_delta)),
      unitsDelta: Money.zero(),
      description: `Reversal of trade #${id}`,
      isBackdated: backdate.isBackdated,
      backdatedReason: backdate.reason,
      createdBy: ctx.actor.userId,
    });
    await db.query(
      `UPDATE qfinera_fund_trades
          SET status = 'REVERSED', reversed_at = now(), reversed_by = $3, reversal_reason = $4, updated_at = now()
        WHERE id = $1 AND fund_id = $2`,
      [id, ctx.fundId, ctx.actor.userId, input.reason.trim()]
    );
    await assertCashNeverNegativeFrom(db, ctx.fundId, effective);

    const after = await loadTrade(db, ctx.fundId, id);
    await writeAudit(db, {
      fundId: ctx.fundId,
      userId: ctx.actor.userId,
      action: "trade.reversed",
      entityType: "trade",
      entityId: id,
      before: auditState(before),
      after: auditState(after),
      reason: input.reason.trim(),
      meta: ctx.meta,
    });
    return after;
  });
}

// ------------------------------------------------------------------ reads

export type TradeFilter = {
  status: TradeStatus | null;
  side: TradeSide | null;
  instrumentId: number | null;
  from: string | null;
  to: string | null;
  pageSize: number;
  offset: number;
};

/** Drafts are internal working records: visible to those who can create trades. */
export async function listTrades(db: Db, actor: FundActor, fundId: number, f: TradeFilter): Promise<{ rows: TradeRecord[]; total: number }> {
  const seesDrafts = hasPermission(actor, "trades:create");
  const where = `t.fund_id = $1
    AND ($2::text IS NULL OR t.status = $2)
    AND ($3::text IS NULL OR t.side = $3)
    AND ($4::int IS NULL OR t.instrument_id = $4)
    AND ($5::date IS NULL OR t.trade_date >= $5::date)
    AND ($6::date IS NULL OR t.trade_date <= $6::date)
    AND ($7::boolean OR t.status NOT IN ('DRAFT', 'CANCELLED'))`;
  const args = [fundId, f.status, f.side, f.instrumentId, f.from, f.to, seesDrafts];
  const count = await one<{ n: number }>(db, `SELECT COUNT(*)::int AS n FROM qfinera_fund_trades t WHERE ${where}`, args);
  const { rows } = await db.query<TradeRecord>(
    `${TRADE_SELECT} WHERE ${where} ORDER BY t.trade_date DESC, t.id DESC LIMIT $8 OFFSET $9`,
    [...args, f.pageSize, f.offset]
  );
  return { rows, total: count?.n ?? 0 };
}

export type TradeDetail = {
  trade: TradeRecord;
  computation: { gross: string; totalCharges: string; net: string; cashDelta: string };
  ledger: Array<{ id: number; entryType: string; entryDate: string; cashDelta: string; isBackdated: boolean; description: string | null }>;
  audit: AuditRecord[] | null;
};

export async function getTradeDetail(db: Db, actor: FundActor, fundId: number, id: number): Promise<TradeDetail> {
  const trade = await loadTrade(db, fundId, id);
  if ((trade.status === "DRAFT" || trade.status === "CANCELLED") && !hasPermission(actor, "trades:create")) {
    throw notFoundError("Trade");
  }
  const c = tradeComputation(trade);
  const { rows } = await db.query<{
    id: number;
    entry_type: string;
    entry_date: string;
    cash_delta: string;
    is_backdated: boolean;
    description: string | null;
  }>(
    `SELECT id, entry_type, entry_date::text AS entry_date, cash_delta::text AS cash_delta, is_backdated, description
       FROM qfinera_fund_ledger_entries
      WHERE fund_id = $1 AND reference_table = 'qfinera_fund_trades' AND reference_id = $2
      ORDER BY id`,
    [fundId, id]
  );
  return {
    trade,
    computation: {
      gross: c.gross.toDecimalString(2),
      totalCharges: c.totalCharges.toDecimalString(2),
      net: c.net.toDecimalString(2),
      cashDelta: c.cashDelta.toDecimalString(2),
    },
    ledger: rows.map((r) => ({
      id: r.id,
      entryType: r.entry_type,
      entryDate: r.entry_date,
      cashDelta: r.cash_delta,
      isBackdated: r.is_backdated,
      description: r.description,
    })),
    audit: hasPermission(actor, "audit:view") ? await loadEntityAudit(db, fundId, "trade", id) : null,
  };
}
