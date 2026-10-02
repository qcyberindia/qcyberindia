// Expense lifecycle:  PENDING -> APPROVED (or REJECTED)
//
//   create    MANAGER/ADMIN records a fund expense (no accounting effect yet).
//   approve   ADMIN approves: an EXPENSE ledger entry reduces fund cash on
//             the expense date. It reaches NAV through fund value at the next
//             EOD and never changes anyone's units. Negative cash is a hard
//             failure. An expense dated on or before the latest official NAV
//             is a backdated correction (ADMIN, reason, confirmation).
//   reject    ADMIN, with a reason.
import { Money } from "@/lib/accounting/money";
import { writeAudit } from "@/lib/fund/audit";
import { inTransaction, lockFund, one, type Db } from "@/lib/fund/db";
import { conflictError, notFoundError, validationError } from "@/lib/fund/errors";
import { postLedgerEntry } from "@/lib/fund/ledger-store";
import { assertPermission, type FundActor } from "@/lib/fund/rbac";
import { assertCashNeverNegativeFrom } from "@/lib/fund/state";
import {
  assertFundActive,
  decideBackdate,
  todayIst,
  type BackdateRequest,
  type ServiceCtx,
} from "@/lib/fund/services/types";

export type ExpenseStatus = "PENDING" | "APPROVED" | "REJECTED" | "REVERSED";
export const EXPENSE_STATUSES: readonly ExpenseStatus[] = ["PENDING", "APPROVED", "REJECTED", "REVERSED"];
export const EXPENSE_CATEGORIES = ["BROKERAGE_ACCOUNT", "BANK_CHARGES", "DEMAT", "PROFESSIONAL_FEES", "SOFTWARE", "OTHER"] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export type ExpenseRecord = {
  id: number;
  fund_id: number;
  category: string;
  amount: string;
  expense_date: string;
  description: string | null;
  payment_reference: string | null;
  status: ExpenseStatus;
  created_by: number;
  created_by_name: string | null;
  created_at: Date;
  approved_by: number | null;
  approved_at: Date | null;
};

const EXPENSE_SELECT = `
  SELECT e.id, e.fund_id, e.category, e.amount::text AS amount, e.expense_date::text AS expense_date,
         e.description, e.payment_reference, e.status, e.created_by, u.display_name AS created_by_name,
         e.created_at, e.approved_by, e.approved_at
    FROM qfinera_fund_expenses e
    LEFT JOIN qfinance_users u ON u.id = e.created_by`;

function auditState(e: ExpenseRecord): Record<string, unknown> {
  return {
    status: e.status,
    category: e.category,
    amount: e.amount,
    expense_date: e.expense_date,
    description: e.description,
    payment_reference: e.payment_reference,
  };
}

async function loadExpense(db: Db, fundId: number, id: number, forUpdate = false): Promise<ExpenseRecord> {
  if (forUpdate) await db.query("SELECT id FROM qfinera_fund_expenses WHERE id = $1 AND fund_id = $2 FOR UPDATE", [id, fundId]);
  const row = await one<ExpenseRecord>(db, `${EXPENSE_SELECT} WHERE e.id = $1 AND e.fund_id = $2`, [id, fundId]);
  if (!row) throw notFoundError("Expense");
  return row;
}

export async function createExpense(
  ctx: ServiceCtx,
  input: {
    category: ExpenseCategory;
    amount: Money;
    expenseDate: string;
    description: string;
    paymentReference: string | null;
  },
  now: Date = new Date()
): Promise<ExpenseRecord> {
  assertPermission(ctx.actor, "expenses:create");
  if (input.expenseDate > todayIst(now)) {
    throw validationError("The expense date cannot be in the future.", { expenseDate: "In the future" });
  }
  return inTransaction(async (db) => {
    await assertFundActive(db, ctx.fundId);
    const ins = await one<{ id: number }>(
      db,
      `INSERT INTO qfinera_fund_expenses (fund_id, category, amount, expense_date, description, payment_reference, status, created_by)
       VALUES ($1, $2, $3, $4::date, $5, $6, 'PENDING', $7) RETURNING id`,
      [
        ctx.fundId,
        input.category,
        input.amount.toDecimalString(2),
        input.expenseDate,
        input.description,
        input.paymentReference,
        ctx.actor.userId,
      ]
    );
    if (!ins) throw new Error("expense insert returned no row");
    const row = await loadExpense(db, ctx.fundId, ins.id);
    await writeAudit(db, {
      fundId: ctx.fundId,
      userId: ctx.actor.userId,
      action: "expense.created",
      entityType: "expense",
      entityId: row.id,
      after: auditState(row),
      meta: ctx.meta,
    });
    return row;
  });
}

export async function approveExpense(ctx: ServiceCtx, id: number, backdate: BackdateRequest | null): Promise<ExpenseRecord> {
  assertPermission(ctx.actor, "expenses:approve");
  return inTransaction(async (db) => {
    await lockFund(db, ctx.fundId);
    await assertFundActive(db, ctx.fundId);
    const before = await loadExpense(db, ctx.fundId, id, true);
    if (before.status !== "PENDING") {
      throw conflictError(`Only a PENDING expense can be approved (this one is ${before.status}).`);
    }
    const decision = await decideBackdate(db, ctx, before.expense_date, backdate);
    const amount = Money.fromDecimalString(before.amount);

    await postLedgerEntry(db, {
      fundId: ctx.fundId,
      memberId: null,
      entryType: "EXPENSE",
      referenceTable: "qfinera_fund_expenses",
      referenceId: id,
      entryDate: before.expense_date,
      cashDelta: Money.zero().subtract(amount),
      unitsDelta: Money.zero(),
      description: `Expense #${id}: ${before.category}`,
      isBackdated: decision.isBackdated,
      backdatedReason: decision.reason,
      createdBy: ctx.actor.userId,
    });
    await db.query(
      `UPDATE qfinera_fund_expenses SET status = 'APPROVED', approved_by = $3, approved_at = now(), updated_at = now()
        WHERE id = $1 AND fund_id = $2`,
      [id, ctx.fundId, ctx.actor.userId]
    );
    await assertCashNeverNegativeFrom(db, ctx.fundId, before.expense_date);

    const after = await loadExpense(db, ctx.fundId, id);
    await writeAudit(db, {
      fundId: ctx.fundId,
      userId: ctx.actor.userId,
      action: decision.isBackdated ? "expense.approved_backdated" : "expense.approved",
      entityType: "expense",
      entityId: id,
      before: auditState(before),
      after: auditState(after),
      reason: decision.reason,
      meta: ctx.meta,
    });
    return after;
  });
}

export async function rejectExpense(ctx: ServiceCtx, id: number, reason: string): Promise<ExpenseRecord> {
  assertPermission(ctx.actor, "expenses:approve");
  return inTransaction(async (db) => {
    await lockFund(db, ctx.fundId);
    const before = await loadExpense(db, ctx.fundId, id, true);
    if (before.status !== "PENDING") throw conflictError(`A ${before.status} expense cannot be rejected.`);
    await db.query(
      "UPDATE qfinera_fund_expenses SET status = 'REJECTED', updated_at = now() WHERE id = $1 AND fund_id = $2",
      [id, ctx.fundId]
    );
    const after = await loadExpense(db, ctx.fundId, id);
    await writeAudit(db, {
      fundId: ctx.fundId,
      userId: ctx.actor.userId,
      action: "expense.rejected",
      entityType: "expense",
      entityId: id,
      before: auditState(before),
      after: auditState(after),
      reason,
      meta: ctx.meta,
    });
    return after;
  });
}

export async function listExpenses(
  db: Db,
  actor: FundActor,
  fundId: number,
  opts: { status: ExpenseStatus | null; pageSize: number; offset: number }
): Promise<{ rows: ExpenseRecord[]; total: number }> {
  assertPermission(actor, "expenses:view");
  const where = "e.fund_id = $1 AND ($2::text IS NULL OR e.status = $2)";
  const count = await one<{ n: number }>(db, `SELECT COUNT(*)::int AS n FROM qfinera_fund_expenses e WHERE ${where}`, [
    fundId,
    opts.status,
  ]);
  const { rows } = await db.query<ExpenseRecord>(
    `${EXPENSE_SELECT} WHERE ${where} ORDER BY e.expense_date DESC, e.id DESC LIMIT $3 OFFSET $4`,
    [fundId, opts.status, opts.pageSize, opts.offset]
  );
  return { rows, total: count?.n ?? 0 };
}
