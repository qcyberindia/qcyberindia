// Contribution lifecycle:
//
//   PENDING -> APPROVED -> AWAITING_NAV -> FINALIZED      (or REJECTED / CANCELLED)
//
//   create         member (or MANAGER/ADMIN on a member's behalf) records the transfer
//   approve        ADMIN approves the request
//   confirmFunds   ADMIN confirms the money was received -> AWAITING_NAV
//                  ("funds confirmed, awaiting NAV" is one state).
//                  This timestamp (funds_confirmed_at) is the NAV cutoff event.
//   finalize       when the applicable EOD NAV is official: allocate units,
//                  post the ledger entry, update the member's units.
//
// Segregation of duties: an ADMIN may not approve or confirm their OWN
// contribution while another active ADMIN exists. A sole ADMIN may; the
// step is then audited as self-confirmed.
//
// Units are NEVER allocated at approval. The effective date is the date of
// the NAV used. Residual (amount - units x NAV) belongs to the Fund.
import { Money } from "@/lib/accounting/money";
import { allocateUnits } from "@/lib/accounting/units";
import { applicableNavDate, type NavCutoffConfig } from "@/lib/accounting/nav-cutoff";
import { writeAudit } from "@/lib/fund/audit";
import { inTransaction, lockFund, one, type Db } from "@/lib/fund/db";
import { conflictError, notFoundError, validationError } from "@/lib/fund/errors";
import { postLedgerEntry } from "@/lib/fund/ledger-store";
import { assertPermission } from "@/lib/fund/rbac";
import { assertUnitsReconcile, loadSettings } from "@/lib/fund/state";
import { assertActiveMember, assertFundActive, type NavSnapshotRef, type ServiceCtx } from "@/lib/fund/services/types";

export type ContributionStatus = "PENDING" | "APPROVED" | "AWAITING_NAV" | "FINALIZED" | "REJECTED" | "CANCELLED";

export const PAYMENT_METHODS = ["UPI", "IMPS", "NEFT", "RTGS", "BANK_TRANSFER", "CHEQUE", "CASH", "OTHER"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export type ContributionRecord = {
  id: number;
  fund_id: number;
  member_id: number;
  amount: string;
  payment_date: string;
  utr: string | null;
  payment_proof_reference: string | null;
  payment_method: PaymentMethod | null;
  notes: string | null;
  status: ContributionStatus;
  nav_used: string | null;
  units_allocated: string | null;
  residual: string | null;
  approved_by: number | null;
  approved_at: Date | null;
  funds_confirmed_by: number | null;
  funds_confirmed_at: Date | null;
  effective_date: string | null;
  nav_snapshot_id: number | null;
  finalized_at: Date | null;
  created_by: number;
  created_at: Date;
};

export const CONTRIBUTION_COLS = `
  id, fund_id, member_id, amount::text AS amount, payment_date::text AS payment_date, utr,
  payment_proof_reference, payment_method, notes, status, nav_used::text AS nav_used, units_allocated::text AS units_allocated,
  residual::text AS residual, approved_by, approved_at, funds_confirmed_by, funds_confirmed_at,
  effective_date::text AS effective_date, nav_snapshot_id, finalized_at, created_by, created_at`;

function auditState(r: ContributionRecord): Record<string, unknown> {
  return {
    status: r.status,
    amount: r.amount,
    member_id: r.member_id,
    payment_date: r.payment_date,
    payment_method: r.payment_method,
    utr: r.utr,
    nav_used: r.nav_used,
    units_allocated: r.units_allocated,
    residual: r.residual,
    effective_date: r.effective_date,
    nav_snapshot_id: r.nav_snapshot_id,
  };
}

async function loadForUpdate(db: Db, fundId: number, id: number): Promise<ContributionRecord> {
  // fund_id is part of the lookup: a record from another fund is "not found".
  const row = await one<ContributionRecord>(
    db,
    `SELECT ${CONTRIBUTION_COLS} FROM qfinera_fund_contributions WHERE id = $1 AND fund_id = $2 FOR UPDATE`,
    [id, fundId]
  );
  if (!row) throw notFoundError("Contribution");
  return row;
}

function isUniqueViolation(err: unknown): boolean {
  return (err as { code?: unknown } | null)?.code === "23505";
}

/**
 * The NAV date that applies to a contribution awaiting NAV. It is decided by
 * the cutoff rule at the moment funds are confirmed and stored in
 * effective_date then, so a later change to the cutoff time or holiday list
 * never moves a request that is already waiting. The computed fallback only
 * covers rows confirmed before that was stored.
 */
export function contributionNavDate(row: ContributionRecord, cfg: NavCutoffConfig): string | null {
  if (row.effective_date) return row.effective_date;
  return row.funds_confirmed_at ? applicableNavDate(row.funds_confirmed_at, cfg) : null;
}

export async function createContribution(
  ctx: ServiceCtx,
  input: {
    memberId?: number | null;
    amount: Money;
    paymentDate: string;
    utr: string | null;
    paymentProofReference: string | null;
    paymentMethod?: PaymentMethod | null;
    notes?: string | null;
  }
): Promise<ContributionRecord> {
  const memberId = input.memberId ?? ctx.actor.userId;
  assertPermission(
    ctx.actor,
    memberId === ctx.actor.userId ? "contributions:create_own" : "contributions:create_for_member"
  );
  if (input.paymentProofReference && /^[a-z]+:\/\//i.test(input.paymentProofReference)) {
    throw validationError("Payment proof must be a private storage reference, not a public link.", {
      paymentProofReference: "Not a link",
    });
  }

  try {
    return await inTransaction(async (db) => {
      await assertFundActive(db, ctx.fundId);
      await assertActiveMember(db, ctx.fundId, memberId);

      const row = await one<ContributionRecord>(
        db,
        `INSERT INTO qfinera_fund_contributions
           (fund_id, member_id, amount, payment_date, utr, payment_proof_reference, status, created_by, payment_method, notes)
         VALUES ($1, $2, $3, $4::date, $5, $6, 'PENDING', $7, $8, $9)
         RETURNING ${CONTRIBUTION_COLS}`,
        [
          ctx.fundId,
          memberId,
          input.amount.toDecimalString(2),
          input.paymentDate,
          input.utr,
          input.paymentProofReference,
          ctx.actor.userId,
          input.paymentMethod ?? null,
          input.notes ?? null,
        ]
      );
      if (!row) throw new Error("contribution insert returned no row");

      await writeAudit(db, {
        fundId: ctx.fundId,
        userId: ctx.actor.userId,
        action: "contribution.created",
        entityType: "contribution",
        entityId: row.id,
        after: auditState(row),
        meta: ctx.meta,
      });
      return row;
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw conflictError("A contribution with this UTR already exists in this fund.");
    throw err;
  }
}

export const SELF_CONFIRMED = "Self-confirmed (sole administrator)";

/**
 * Returns true when the actor is acting on their own contribution as the
 * pool's only active ADMIN (allowed, audited as self-confirmed). Refuses
 * when another active ADMIN exists: they must take the step.
 */
async function selfConfirmation(db: Db, ctx: ServiceCtx, row: ContributionRecord, step: string): Promise<boolean> {
  if (row.member_id !== ctx.actor.userId) return false;
  const admins = await one<{ n: number }>(
    db,
    "SELECT COUNT(*)::int AS n FROM qfinera_fund_memberships WHERE fund_id = $1 AND role = 'ADMIN' AND status = 'active'",
    [ctx.fundId]
  );
  if ((admins?.n ?? 0) > 1) {
    throw conflictError(`You cannot ${step} your own contribution. Another administrator of this pool must do it.`);
  }
  return true;
}

/** Audit reason for a review step: the reviewer's note, marked when self-confirmed. */
function reviewReason(self: boolean, note: string | null | undefined): string | null {
  const n = note?.trim() || null;
  if (self) return n ? `${SELF_CONFIRMED}. ${n}` : SELF_CONFIRMED;
  return n;
}

export async function approveContribution(ctx: ServiceCtx, id: number, note?: string | null): Promise<ContributionRecord> {
  assertPermission(ctx.actor, "contributions:approve");
  return inTransaction(async (db) => {
    await lockFund(db, ctx.fundId);
    const before = await loadForUpdate(db, ctx.fundId, id);
    if (before.status !== "PENDING") {
      throw conflictError(`Only a PENDING contribution can be approved (this one is ${before.status}).`);
    }
    const self = await selfConfirmation(db, ctx, before, "approve");
    const after = await one<ContributionRecord>(
      db,
      `UPDATE qfinera_fund_contributions
          SET status = 'APPROVED', approved_by = $3, approved_at = now(), updated_at = now()
        WHERE id = $1 AND fund_id = $2
        RETURNING ${CONTRIBUTION_COLS}`,
      [id, ctx.fundId, ctx.actor.userId]
    );
    if (!after) throw notFoundError("Contribution");
    await writeAudit(db, {
      fundId: ctx.fundId,
      userId: ctx.actor.userId,
      action: self ? "contribution.self_approved" : "contribution.approved",
      entityType: "contribution",
      entityId: id,
      before: auditState(before),
      after: { ...auditState(after), self_confirmed: self },
      reason: reviewReason(self, note),
      meta: ctx.meta,
    });
    return after;
  });
}

/** ADMIN confirms the money arrived. Starts the wait for the next EOD NAV. */
export async function confirmContributionFunds(
  ctx: ServiceCtx,
  id: number,
  note?: string | null
): Promise<{ contribution: ContributionRecord; applicableNavDate: string }> {
  assertPermission(ctx.actor, "contributions:confirm_funds");
  return inTransaction(async (db) => {
    await lockFund(db, ctx.fundId);
    const before = await loadForUpdate(db, ctx.fundId, id);
    if (before.status !== "APPROVED") {
      throw conflictError(`Funds can only be confirmed for an APPROVED contribution (this one is ${before.status}).`);
    }
    const self = await selfConfirmation(db, ctx, before, "confirm funds for");
    const confirmed = await one<ContributionRecord>(
      db,
      `UPDATE qfinera_fund_contributions
          SET status = 'AWAITING_NAV', funds_confirmed_by = $3, funds_confirmed_at = now(), updated_at = now()
        WHERE id = $1 AND fund_id = $2
        RETURNING ${CONTRIBUTION_COLS}`,
      [id, ctx.fundId, ctx.actor.userId]
    );
    if (!confirmed?.funds_confirmed_at) throw notFoundError("Contribution");

    const settings = await loadSettings(db, ctx.fundId);
    const navDate = applicableNavDate(confirmed.funds_confirmed_at, settings.nav);
    const after = await one<ContributionRecord>(
      db,
      `UPDATE qfinera_fund_contributions SET effective_date = $3::date
        WHERE id = $1 AND fund_id = $2 RETURNING ${CONTRIBUTION_COLS}`,
      [id, ctx.fundId, navDate]
    );
    if (!after) throw notFoundError("Contribution");

    await writeAudit(db, {
      fundId: ctx.fundId,
      userId: ctx.actor.userId,
      action: self ? "contribution.self_confirmed_funds" : "contribution.funds_confirmed",
      entityType: "contribution",
      entityId: id,
      before: auditState(before),
      after: { ...auditState(after), applicable_nav_date: navDate, self_confirmed: self },
      reason: reviewReason(self, note),
      meta: ctx.meta,
    });
    return { contribution: after, applicableNavDate: navDate };
  });
}

export async function rejectContribution(ctx: ServiceCtx, id: number, reason: string): Promise<ContributionRecord> {
  assertPermission(ctx.actor, "contributions:approve");
  return inTransaction(async (db) => {
    await lockFund(db, ctx.fundId);
    const before = await loadForUpdate(db, ctx.fundId, id);
    if (before.status !== "PENDING" && before.status !== "APPROVED") {
      throw conflictError(`A ${before.status} contribution cannot be rejected.`);
    }
    const after = await one<ContributionRecord>(
      db,
      `UPDATE qfinera_fund_contributions SET status = 'REJECTED', updated_at = now()
        WHERE id = $1 AND fund_id = $2 RETURNING ${CONTRIBUTION_COLS}`,
      [id, ctx.fundId]
    );
    if (!after) throw notFoundError("Contribution");
    await writeAudit(db, {
      fundId: ctx.fundId,
      userId: ctx.actor.userId,
      action: "contribution.rejected",
      entityType: "contribution",
      entityId: id,
      before: auditState(before),
      after: auditState(after),
      reason,
      meta: ctx.meta,
    });
    return after;
  });
}

/** The member may cancel their own PENDING request; an ADMIN may cancel before NAV. */
export async function cancelContribution(ctx: ServiceCtx, id: number, reason: string | null): Promise<ContributionRecord> {
  return inTransaction(async (db) => {
    await lockFund(db, ctx.fundId);
    const before = await loadForUpdate(db, ctx.fundId, id);

    const isOwner = before.member_id === ctx.actor.userId;
    if (isOwner) assertPermission(ctx.actor, "contributions:view_own");
    else assertPermission(ctx.actor, "contributions:approve");

    const cancellable = isOwner ? ["PENDING"] : ["PENDING", "APPROVED", "AWAITING_NAV"];
    if (!cancellable.includes(before.status)) {
      throw conflictError(`This contribution is ${before.status} and cannot be cancelled by you.`);
    }
    const after = await one<ContributionRecord>(
      db,
      `UPDATE qfinera_fund_contributions SET status = 'CANCELLED', effective_date = NULL, updated_at = now()
        WHERE id = $1 AND fund_id = $2 RETURNING ${CONTRIBUTION_COLS}`,
      [id, ctx.fundId]
    );
    if (!after) throw notFoundError("Contribution");
    await writeAudit(db, {
      fundId: ctx.fundId,
      userId: ctx.actor.userId,
      action: "contribution.cancelled",
      entityType: "contribution",
      entityId: id,
      before: auditState(before),
      after: auditState(after),
      reason,
      meta: ctx.meta,
    });
    return after;
  });
}

/**
 * Pure allocation step: how many units does this contribution buy at the
 * given official NAV, and what residual does the Fund keep?
 */
export function allocateContribution(row: Pick<ContributionRecord, "amount">, nav: Money) {
  return allocateUnits(Money.fromDecimalString(row.amount), nav);
}

/**
 * Finalizes one contribution against an official NAV snapshot, inside the
 * caller's transaction (the fund lock must already be held).
 */
export async function finalizeContributionInDb(
  db: Db,
  ctx: ServiceCtx,
  row: ContributionRecord,
  snapshot: NavSnapshotRef
): Promise<ContributionRecord> {
  if (row.status !== "AWAITING_NAV") {
    throw conflictError(`Only a contribution AWAITING_NAV can be finalized (this one is ${row.status}).`);
  }

  const amount = Money.fromDecimalString(row.amount);
  const { units, residual } = allocateContribution(row, snapshot.nav);

  await postLedgerEntry(db, {
    fundId: ctx.fundId,
    memberId: row.member_id,
    entryType: "CONTRIBUTION",
    referenceTable: "qfinera_fund_contributions",
    referenceId: row.id,
    entryDate: snapshot.asOfDate,
    cashDelta: amount,
    unitsDelta: units,
    description: `Contribution #${row.id}: ${units.toDecimalString(4)} units at NAV ${snapshot.nav.toDecimalString(4)}`,
    createdBy: ctx.actor.userId,
  });

  const after = await one<ContributionRecord>(
    db,
    `UPDATE qfinera_fund_contributions
        SET status = 'FINALIZED', nav_used = $3, units_allocated = $4, residual = $5,
            effective_date = $6::date, nav_snapshot_id = $7, finalized_at = now(), updated_at = now()
      WHERE id = $1 AND fund_id = $2
      RETURNING ${CONTRIBUTION_COLS}`,
    [
      row.id,
      ctx.fundId,
      snapshot.nav.toDecimalString(4),
      units.toDecimalString(4),
      residual.toDecimalString(8),
      snapshot.asOfDate,
      snapshot.id,
    ]
  );
  if (!after) throw notFoundError("Contribution");

  await db.query(
    `UPDATE qfinera_fund_memberships SET units = units + $3, updated_at = now()
      WHERE fund_id = $1 AND user_id = $2`,
    [ctx.fundId, row.member_id, units.toDecimalString(4)]
  );
  await assertUnitsReconcile(db, ctx.fundId);

  await writeAudit(db, {
    fundId: ctx.fundId,
    userId: ctx.actor.userId,
    action: "contribution.finalized",
    entityType: "contribution",
    entityId: row.id,
    before: auditState(row),
    after: auditState(after),
    meta: ctx.meta,
  });
  return after;
}

/** Looks up the official NAV for a date, or null if it is not struck yet. */
export async function findOfficialNav(db: Db, fundId: number, date: string): Promise<NavSnapshotRef | null> {
  const row = await one<{ id: number; as_of_date: string; nav: string }>(
    db,
    `SELECT id, as_of_date::text AS as_of_date, nav::text AS nav
       FROM qfinera_fund_nav_snapshots WHERE fund_id = $1 AND as_of_date = $2::date AND is_official`,
    [fundId, date]
  );
  return row ? { id: row.id, asOfDate: row.as_of_date, nav: Money.fromDecimalString(row.nav) } : null;
}

/** Retry path: finalize one contribution whose applicable official NAV now exists. */
export async function finalizeContribution(ctx: ServiceCtx, id: number): Promise<ContributionRecord> {
  assertPermission(ctx.actor, "nav:finalize");
  return inTransaction(async (db) => {
    await lockFund(db, ctx.fundId);
    const row = await loadForUpdate(db, ctx.fundId, id);
    if (row.status !== "AWAITING_NAV") {
      throw conflictError(`Only a contribution AWAITING_NAV can be finalized (this one is ${row.status}).`);
    }
    const settings = await loadSettings(db, ctx.fundId);
    const date = contributionNavDate(row, settings.nav);
    if (!date) throw conflictError("Funds have not been confirmed for this contribution.");
    const snapshot = await findOfficialNav(db, ctx.fundId, date);
    if (!snapshot) throw conflictError(`The official NAV for ${date} has not been finalized yet.`);
    return finalizeContributionInDb(db, ctx, row, snapshot);
  });
}
