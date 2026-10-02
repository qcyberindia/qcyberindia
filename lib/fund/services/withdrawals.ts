// Withdrawal lifecycle:
//
//   REQUESTED -> AWAITING_NAV -> FINALIZED      (or REJECTED / CANCELLED)
//
//   create     member (or MANAGER/ADMIN on a member's behalf) asks to redeem
//              an AMOUNT or a number of UNITS. One open request per member.
//   approve    ADMIN approves, fixing the approved amount/units and charges.
//              approved_at is the NAV cutoff event, so approval moves the
//              request straight to AWAITING_NAV with its NAV date locked in
//              (APPROVED is never a resting state for a withdrawal).
//   finalize   when that EOD NAV is official: redeem units, post the ledger
//              entry, reduce the member's units. Fund cash decreases by the
//              NET amount; the charge and the rounding residual stay in the
//              Fund (lib/accounting/withdrawals.ts).
//
// Nothing is redeemed before the applicable EOD NAV exists. Insufficient
// member units or fund cash is a hard failure: the request stays
// AWAITING_NAV and nothing is written.
import { assertNoViolations } from "@/lib/accounting/invariants";
import { Money } from "@/lib/accounting/money";
import { applicableNavDate } from "@/lib/accounting/nav-cutoff";
import {
  checkWithdrawalFeasible,
  computeWithdrawalByAmount,
  computeWithdrawalByUnits,
  type WithdrawalComputation,
} from "@/lib/accounting/withdrawals";
import { loadEntityAudit, writeAudit, type AuditRecord } from "@/lib/fund/audit";
import { inTransaction, lockFund, one, type Db } from "@/lib/fund/db";
import { conflictError, notFoundError, validationError } from "@/lib/fund/errors";
import { postLedgerEntry } from "@/lib/fund/ledger-store";
import { memberValue } from "@/lib/fund/metrics";
import { assertPermission, canViewMemberRecord, hasPermission, type FundActor } from "@/lib/fund/rbac";
import {
  assertCashNeverNegativeFrom,
  assertUnitsReconcile,
  getMemberUnits,
  ledgerStateNow,
  loadSettings,
} from "@/lib/fund/state";
import {
  accountingRule,
  assertActiveMember,
  assertFundActive,
  isUniqueViolation,
  type NavSnapshotRef,
  type ServiceCtx,
} from "@/lib/fund/services/types";

export type WithdrawalStatus = "REQUESTED" | "APPROVED" | "AWAITING_NAV" | "FINALIZED" | "REJECTED" | "CANCELLED";
export type WithdrawalRequestType = "AMOUNT" | "UNITS";

export const WITHDRAWAL_STATUSES: readonly WithdrawalStatus[] = [
  "REQUESTED",
  "APPROVED",
  "AWAITING_NAV",
  "FINALIZED",
  "REJECTED",
  "CANCELLED",
];

const OPEN_STATUSES: readonly WithdrawalStatus[] = ["REQUESTED", "APPROVED", "AWAITING_NAV"];

export type WithdrawalRecord = {
  id: number;
  fund_id: number;
  member_id: number;
  request_type: WithdrawalRequestType;
  requested_amount: string | null;
  requested_units: string | null;
  approved_amount: string | null;
  approved_units: string | null;
  charges: string;
  status: WithdrawalStatus;
  nav_used: string | null;
  units_redeemed: string | null;
  gross_amount: string | null;
  net_amount: string | null;
  residual: string | null;
  effective_date: string | null;
  nav_snapshot_id: number | null;
  approved_by: number | null;
  approved_at: Date | null;
  finalized_at: Date | null;
  is_backdated: boolean;
  created_by: number;
  created_at: Date;
};

export const WITHDRAWAL_COLS = `
  id, fund_id, member_id, request_type, requested_amount::text AS requested_amount,
  requested_units::text AS requested_units, approved_amount::text AS approved_amount,
  approved_units::text AS approved_units, charges::text AS charges, status, nav_used::text AS nav_used,
  units_redeemed::text AS units_redeemed, gross_amount::text AS gross_amount, net_amount::text AS net_amount,
  residual::text AS residual, effective_date::text AS effective_date, nav_snapshot_id, approved_by, approved_at,
  finalized_at, is_backdated, created_by, created_at`;

const m = (s: string | null | undefined) => Money.fromDecimalString(s ?? "0");

function auditState(r: WithdrawalRecord): Record<string, unknown> {
  return {
    status: r.status,
    member_id: r.member_id,
    request_type: r.request_type,
    requested_amount: r.requested_amount,
    requested_units: r.requested_units,
    approved_amount: r.approved_amount,
    approved_units: r.approved_units,
    charges: r.charges,
    nav_used: r.nav_used,
    units_redeemed: r.units_redeemed,
    gross_amount: r.gross_amount,
    net_amount: r.net_amount,
    residual: r.residual,
    effective_date: r.effective_date,
    nav_snapshot_id: r.nav_snapshot_id,
  };
}

async function loadForUpdate(db: Db, fundId: number, id: number): Promise<WithdrawalRecord> {
  const row = await one<WithdrawalRecord>(
    db,
    `SELECT ${WITHDRAWAL_COLS} FROM qfinera_fund_withdrawals WHERE id = $1 AND fund_id = $2 FOR UPDATE`,
    [id, fundId]
  );
  if (!row) throw notFoundError("Withdrawal");
  return row;
}

async function update(db: Db, fundId: number, id: number, set: string, values: unknown[]): Promise<WithdrawalRecord> {
  const row = await one<WithdrawalRecord>(
    db,
    `UPDATE qfinera_fund_withdrawals SET ${set}, updated_at = now()
      WHERE id = $1 AND fund_id = $2 RETURNING ${WITHDRAWAL_COLS}`,
    [id, fundId, ...values]
  );
  if (!row) throw notFoundError("Withdrawal");
  return row;
}

/** Pure redemption step at an official NAV (throws the accounting rule as a 409). */
export function computeRedemption(row: WithdrawalRecord, nav: Money): WithdrawalComputation {
  const charges = m(row.charges);
  return accountingRule(() =>
    row.request_type === "AMOUNT"
      ? computeWithdrawalByAmount(m(row.approved_amount ?? row.requested_amount), nav, charges)
      : computeWithdrawalByUnits(m(row.approved_units ?? row.requested_units), nav, charges)
  );
}

export type CreateWithdrawalInput = {
  memberId?: number | null;
  requestType: WithdrawalRequestType;
  amount: Money | null;
  units: Money | null;
};

export async function createWithdrawal(ctx: ServiceCtx, input: CreateWithdrawalInput): Promise<WithdrawalRecord> {
  const memberId = input.memberId ?? ctx.actor.userId;
  assertPermission(
    ctx.actor,
    memberId === ctx.actor.userId ? "withdrawals:create_own" : "withdrawals:create_for_member"
  );
  if (input.requestType === "AMOUNT" && !input.amount) {
    throw validationError("Enter the amount to withdraw.", { amount: "Required" });
  }
  if (input.requestType === "UNITS" && !input.units) {
    throw validationError("Enter the number of units to redeem.", { units: "Required" });
  }

  try {
    return await inTransaction(async (db) => {
      await lockFund(db, ctx.fundId);
      await assertFundActive(db, ctx.fundId);
      await assertActiveMember(db, ctx.fundId, memberId);

      const open = await one<{ id: number }>(
        db,
        `SELECT id FROM qfinera_fund_withdrawals
          WHERE fund_id = $1 AND member_id = $2 AND status = ANY($3::text[]) LIMIT 1`,
        [ctx.fundId, memberId, OPEN_STATUSES]
      );
      if (open) {
        throw conflictError(`There is already an open withdrawal request (#${open.id}) for this member.`);
      }

      // Early, honest checks against what the member holds now. The binding
      // check happens again at finalization, at the official NAV.
      const held = await getMemberUnits(db, ctx.fundId, memberId);
      if (held.isZero()) throw conflictError("This member holds no units to withdraw.");
      if (input.requestType === "UNITS" && input.units && input.units.compare(held) > 0) {
        throw validationError(`Only ${held.toDecimalString(4)} units are held.`, { units: "More than held" });
      }
      if (input.requestType === "AMOUNT" && input.amount) {
        const nav = await one<{ nav: string }>(
          db,
          `SELECT nav::text AS nav FROM qfinera_fund_nav_snapshots
            WHERE fund_id = $1 AND is_official ORDER BY as_of_date DESC LIMIT 1`,
          [ctx.fundId]
        );
        const value = memberValue(held, nav ? m(nav.nav) : null);
        if (value && input.amount.compare(value) > 0) {
          throw validationError(
            `That is more than the holding is worth at the latest official NAV (${value.toDecimalString(2)}).`,
            { amount: "More than the holding is worth" }
          );
        }
      }

      const row = await one<WithdrawalRecord>(
        db,
        `INSERT INTO qfinera_fund_withdrawals
           (fund_id, member_id, request_type, requested_amount, requested_units, status, created_by)
         VALUES ($1, $2, $3, $4, $5, 'REQUESTED', $6)
         RETURNING ${WITHDRAWAL_COLS}`,
        [
          ctx.fundId,
          memberId,
          input.requestType,
          input.requestType === "AMOUNT" ? input.amount?.toDecimalString(2) : null,
          input.requestType === "UNITS" ? input.units?.toDecimalString(4) : null,
          ctx.actor.userId,
        ]
      );
      if (!row) throw new Error("withdrawal insert returned no row");

      await writeAudit(db, {
        fundId: ctx.fundId,
        userId: ctx.actor.userId,
        action: "withdrawal.created",
        entityType: "withdrawal",
        entityId: row.id,
        after: auditState(row),
        meta: ctx.meta,
      });
      return row;
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw conflictError("There is already an open withdrawal request for this member.");
    throw err;
  }
}

/** ADMIN approval. Charges (2 dp, kept by the Fund) are fixed here. */
export async function approveWithdrawal(
  ctx: ServiceCtx,
  id: number,
  input: { charges: Money }
): Promise<{ withdrawal: WithdrawalRecord; applicableNavDate: string }> {
  assertPermission(ctx.actor, "withdrawals:approve");
  return inTransaction(async (db) => {
    await lockFund(db, ctx.fundId);
    await assertFundActive(db, ctx.fundId);
    const before = await loadForUpdate(db, ctx.fundId, id);
    if (before.status !== "REQUESTED") {
      throw conflictError(`Only a REQUESTED withdrawal can be approved (this one is ${before.status}).`);
    }
    await assertActiveMember(db, ctx.fundId, before.member_id);

    if (before.request_type === "AMOUNT" && input.charges.compare(m(before.requested_amount)) >= 0) {
      throw validationError("Charges must be less than the withdrawal amount.", { charges: "Too high" });
    }
    if (before.request_type === "UNITS") {
      const held = await getMemberUnits(db, ctx.fundId, before.member_id);
      if (m(before.requested_units).compare(held) > 0) {
        throw conflictError(`The member now holds only ${held.toDecimalString(4)} units.`);
      }
    }

    const approved = await update(
      db,
      ctx.fundId,
      id,
      `status = 'AWAITING_NAV', approved_by = $3, approved_at = now(), charges = $4,
       approved_amount = requested_amount, approved_units = requested_units`,
      [ctx.actor.userId, input.charges.toDecimalString(2)]
    );
    if (!approved.approved_at) throw new Error("approved_at missing after approval");
    const settings = await loadSettings(db, ctx.fundId);
    const navDate = applicableNavDate(approved.approved_at, settings.nav);
    const after = await update(db, ctx.fundId, id, "effective_date = $3::date", [navDate]);

    await writeAudit(db, {
      fundId: ctx.fundId,
      userId: ctx.actor.userId,
      action: "withdrawal.approved",
      entityType: "withdrawal",
      entityId: id,
      before: auditState(before),
      after: { ...auditState(after), applicable_nav_date: navDate },
      meta: ctx.meta,
    });
    return { withdrawal: after, applicableNavDate: navDate };
  });
}

export async function rejectWithdrawal(ctx: ServiceCtx, id: number, reason: string): Promise<WithdrawalRecord> {
  assertPermission(ctx.actor, "withdrawals:approve");
  return inTransaction(async (db) => {
    await lockFund(db, ctx.fundId);
    const before = await loadForUpdate(db, ctx.fundId, id);
    if (before.status !== "REQUESTED") {
      throw conflictError(`A ${before.status} withdrawal cannot be rejected.`);
    }
    const after = await update(db, ctx.fundId, id, "status = 'REJECTED'", []);
    await writeAudit(db, {
      fundId: ctx.fundId,
      userId: ctx.actor.userId,
      action: "withdrawal.rejected",
      entityType: "withdrawal",
      entityId: id,
      before: auditState(before),
      after: auditState(after),
      reason,
      meta: ctx.meta,
    });
    return after;
  });
}

/** The member may cancel their own REQUESTED withdrawal; an ADMIN may cancel any open one. */
export async function cancelWithdrawal(ctx: ServiceCtx, id: number, reason: string | null): Promise<WithdrawalRecord> {
  return inTransaction(async (db) => {
    await lockFund(db, ctx.fundId);
    const before = await loadForUpdate(db, ctx.fundId, id);
    const isAdmin = hasPermission(ctx.actor, "withdrawals:approve");
    const isOwner = before.member_id === ctx.actor.userId;

    if (!isAdmin) {
      assertPermission(ctx.actor, "withdrawals:view_own");
      if (!isOwner) throw notFoundError("Withdrawal");
    }
    const cancellable: readonly WithdrawalStatus[] = isAdmin ? OPEN_STATUSES : ["REQUESTED"];
    if (!cancellable.includes(before.status)) {
      throw conflictError(`This withdrawal is ${before.status} and cannot be cancelled by you.`);
    }
    if (isAdmin && !isOwner && before.status !== "REQUESTED" && !reason) {
      throw validationError("Give a reason for cancelling an approved withdrawal.", { reason: "Required" });
    }
    const after = await update(db, ctx.fundId, id, "status = 'CANCELLED', effective_date = NULL", []);
    await writeAudit(db, {
      fundId: ctx.fundId,
      userId: ctx.actor.userId,
      action: "withdrawal.cancelled",
      entityType: "withdrawal",
      entityId: id,
      before: auditState(before),
      after: auditState(after),
      reason,
      meta: ctx.meta,
    });
    return after;
  });
}

/** The NAV date that applies to a withdrawal awaiting NAV (locked in at approval). */
export function withdrawalNavDate(row: WithdrawalRecord): string | null {
  return row.status === "AWAITING_NAV" ? row.effective_date : null;
}

/**
 * Finalizes one withdrawal against an official NAV snapshot, inside the
 * caller's transaction (the fund lock must already be held).
 */
export async function finalizeWithdrawalInDb(
  db: Db,
  ctx: ServiceCtx,
  row: WithdrawalRecord,
  snapshot: NavSnapshotRef
): Promise<WithdrawalRecord> {
  if (row.status !== "AWAITING_NAV") {
    throw conflictError(`Only a withdrawal AWAITING_NAV can be finalized (this one is ${row.status}).`);
  }
  if (row.effective_date !== snapshot.asOfDate) {
    throw conflictError(`This withdrawal redeems at the NAV of ${row.effective_date}, not ${snapshot.asOfDate}.`);
  }

  const computation = computeRedemption(row, snapshot.nav);
  const [memberUnits, ledger] = await Promise.all([
    getMemberUnits(db, ctx.fundId, row.member_id),
    ledgerStateNow(db, ctx.fundId),
  ]);
  assertNoViolations(
    checkWithdrawalFeasible({ memberId: row.member_id, memberUnits, fundCash: ledger.cash, computation })
  );

  await postLedgerEntry(db, {
    fundId: ctx.fundId,
    memberId: row.member_id,
    entryType: "WITHDRAWAL",
    referenceTable: "qfinera_fund_withdrawals",
    referenceId: row.id,
    entryDate: snapshot.asOfDate,
    cashDelta: Money.zero().subtract(computation.net),
    unitsDelta: Money.zero().subtract(computation.unitsRedeemed),
    description: `Withdrawal #${row.id}: ${computation.unitsRedeemed.toDecimalString(4)} units at NAV ${snapshot.nav.toDecimalString(4)}`,
    createdBy: ctx.actor.userId,
  });

  const after = await update(
    db,
    ctx.fundId,
    row.id,
    `status = 'FINALIZED', nav_used = $3, units_redeemed = $4, gross_amount = $5, net_amount = $6,
     residual = $7, nav_snapshot_id = $8, finalized_at = now()`,
    [
      snapshot.nav.toDecimalString(4),
      computation.unitsRedeemed.toDecimalString(4),
      computation.gross.toDecimalString(2),
      computation.net.toDecimalString(2),
      computation.residual.toDecimalString(8),
      snapshot.id,
    ]
  );

  await db.query(
    `UPDATE qfinera_fund_memberships SET units = units - $3, updated_at = now()
      WHERE fund_id = $1 AND user_id = $2`,
    [ctx.fundId, row.member_id, computation.unitsRedeemed.toDecimalString(4)]
  );
  await assertUnitsReconcile(db, ctx.fundId);
  await assertCashNeverNegativeFrom(db, ctx.fundId, snapshot.asOfDate);

  await writeAudit(db, {
    fundId: ctx.fundId,
    userId: ctx.actor.userId,
    action: "withdrawal.finalized",
    entityType: "withdrawal",
    entityId: row.id,
    before: auditState(row),
    after: auditState(after),
    meta: ctx.meta,
  });
  return after;
}

/** Retry path: finalize one withdrawal whose applicable official NAV now exists. */
export async function finalizeWithdrawal(ctx: ServiceCtx, id: number): Promise<WithdrawalRecord> {
  assertPermission(ctx.actor, "nav:finalize");
  return inTransaction(async (db) => {
    await lockFund(db, ctx.fundId);
    const row = await loadForUpdate(db, ctx.fundId, id);
    const date = withdrawalNavDate(row);
    if (!date) throw conflictError(`Only a withdrawal AWAITING_NAV can be finalized (this one is ${row.status}).`);
    const snap = await one<{ id: number; as_of_date: string; nav: string }>(
      db,
      `SELECT id, as_of_date::text AS as_of_date, nav::text AS nav FROM qfinera_fund_nav_snapshots
        WHERE fund_id = $1 AND as_of_date = $2::date AND is_official`,
      [ctx.fundId, date]
    );
    if (!snap) throw conflictError(`The official NAV for ${date} has not been finalized yet.`);
    return finalizeWithdrawalInDb(db, ctx, row, { id: snap.id, asOfDate: snap.as_of_date, nav: m(snap.nav) });
  });
}

// ------------------------------------------------------------------ reads

export type WithdrawalListRow = {
  id: number;
  memberId: number;
  memberName: string;
  requestType: WithdrawalRequestType;
  requestedAmount: string | null;
  requestedUnits: string | null;
  charges: string;
  status: WithdrawalStatus;
  effectiveDate: string | null;
  navUsed: string | null;
  unitsRedeemed: string | null;
  grossAmount: string | null;
  netAmount: string | null;
  createdAt: Date;
  approvedAt: Date | null;
  finalizedAt: Date | null;
};

export async function listWithdrawals(
  db: Db,
  actor: FundActor,
  fundId: number,
  opts: { status: WithdrawalStatus | null; memberId: number | null; pageSize: number; offset: number }
): Promise<{ rows: WithdrawalListRow[]; total: number }> {
  // Visibility comes from the role, never the request.
  const memberId = hasPermission(actor, "withdrawals:view_all") ? opts.memberId : actor.userId;
  const where = `w.fund_id = $1 AND ($2::int IS NULL OR w.member_id = $2) AND ($3::text IS NULL OR w.status = $3)`;
  const count = await one<{ n: number }>(
    db,
    `SELECT COUNT(*)::int AS n FROM qfinera_fund_withdrawals w WHERE ${where}`,
    [fundId, memberId, opts.status]
  );
  const { rows } = await db.query<WithdrawalRecord & { member_name: string }>(
    `SELECT w.*, u.display_name AS member_name
       FROM (SELECT ${WITHDRAWAL_COLS} FROM qfinera_fund_withdrawals) w
       JOIN qfinance_users u ON u.id = w.member_id
      WHERE ${where}
      ORDER BY w.created_at DESC, w.id DESC
      LIMIT $4 OFFSET $5`,
    [fundId, memberId, opts.status, opts.pageSize, opts.offset]
  );
  return {
    total: count?.n ?? 0,
    rows: rows.map((r) => ({
      id: r.id,
      memberId: r.member_id,
      memberName: r.member_name,
      requestType: r.request_type,
      requestedAmount: r.requested_amount,
      requestedUnits: r.requested_units,
      charges: r.charges,
      status: r.status,
      effectiveDate: r.effective_date,
      navUsed: r.nav_used,
      unitsRedeemed: r.units_redeemed,
      grossAmount: r.gross_amount,
      netAmount: r.net_amount,
      createdAt: r.created_at,
      approvedAt: r.approved_at,
      finalizedAt: r.finalized_at,
    })),
  };
}

export type WithdrawalDetail = {
  withdrawal: WithdrawalRecord;
  memberName: string;
  /** Units the member holds now (context for approval). Privileged roles and the owner only. */
  memberUnits: string;
  awaiting: { navDate: string; navOfficial: boolean } | null;
  audit: AuditRecord[] | null;
};

export async function getWithdrawalDetail(db: Db, actor: FundActor, fundId: number, id: number): Promise<WithdrawalDetail> {
  const row = await one<WithdrawalRecord>(
    db,
    `SELECT ${WITHDRAWAL_COLS} FROM qfinera_fund_withdrawals WHERE id = $1 AND fund_id = $2`,
    [id, fundId]
  );
  if (!row || !canViewMemberRecord(actor, row.member_id, "withdrawals")) throw notFoundError("Withdrawal");

  const [user, units] = await Promise.all([
    one<{ display_name: string }>(db, "SELECT display_name FROM qfinance_users WHERE id = $1", [row.member_id]),
    getMemberUnits(db, fundId, row.member_id),
  ]);
  const navDate = withdrawalNavDate(row);
  let awaiting: WithdrawalDetail["awaiting"] = null;
  if (navDate) {
    const snap = await one<{ id: number }>(
      db,
      "SELECT id FROM qfinera_fund_nav_snapshots WHERE fund_id = $1 AND as_of_date = $2::date AND is_official",
      [fundId, navDate]
    );
    awaiting = { navDate, navOfficial: Boolean(snap) };
  }
  return {
    withdrawal: row,
    memberName: user?.display_name ?? "Unknown member",
    memberUnits: units.toDecimalString(4),
    awaiting,
    audit: hasPermission(actor, "audit:view") ? await loadEntityAudit(db, fundId, "withdrawal", id) : null,
  };
}
