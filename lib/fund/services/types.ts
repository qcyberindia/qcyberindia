import { InvariantError } from "@/lib/accounting/invariants";
import { toIstParts } from "@/lib/accounting/nav-cutoff";
import type { RequestMeta } from "@/lib/fund/audit";
import { one, type Db } from "@/lib/fund/db";
import { FundError, conflictError, notFoundError, validationError } from "@/lib/fund/errors";
import { hasPermission, type FundActor } from "@/lib/fund/rbac";
import { latestOfficialNavDate } from "@/lib/fund/state";
import type { Money } from "@/lib/accounting/money";

/** Who is acting, in which fund. Built from a verified FundContext. */
export type ServiceCtx = {
  fundId: number;
  actor: FundActor;
  meta?: RequestMeta | null;
};

/** An official NAV snapshot, as needed to allocate or redeem units. */
export type NavSnapshotRef = {
  id: number;
  asOfDate: string;
  nav: Money;
};

export function todayIst(now: Date = new Date()): string {
  return toIstParts(now).date;
}

/** Throws unless the fund exists and is active. */
export async function assertFundActive(db: Db, fundId: number): Promise<void> {
  const row = await one<{ status: string; deleted: boolean }>(
    db,
    "SELECT status, deleted_at IS NOT NULL AS deleted FROM qfinera_funds WHERE id = $1",
    [fundId]
  );
  if (!row || row.deleted) throw notFoundError("Fund");
  if (row.status !== "active") throw conflictError("This fund is closed.");
}

/** Throws unless `userId` is an ACTIVE member of the fund. */
export async function assertActiveMember(db: Db, fundId: number, userId: number): Promise<void> {
  const row = await one<{ status: string }>(
    db,
    "SELECT status FROM qfinera_fund_memberships WHERE fund_id = $1 AND user_id = $2",
    [fundId, userId]
  );
  if (!row) throw notFoundError("Member");
  if (row.status !== "active") throw conflictError("That member's membership is suspended.");
}

/** Postgres unique-violation (a duplicate business key or a raced double-submit). */
export function isUniqueViolation(err: unknown): boolean {
  return (err as { code?: unknown } | null)?.code === "23505";
}

/**
 * Runs pure accounting code and reports its rule violations (plain Errors
 * thrown by lib/accounting, e.g. "charges must be less than the withdrawal
 * amount") as a 409 the user can act on. Errors that carry a database code,
 * FundErrors and InvariantErrors pass through unchanged.
 */
export function accountingRule<T>(fn: () => T): T {
  const convert = (err: unknown): never => {
    if (err instanceof FundError || err instanceof InvariantError) throw err;
    if (err instanceof Error && (err as { code?: unknown }).code === undefined) {
      throw conflictError(err.message.charAt(0).toUpperCase() + err.message.slice(1) + ".");
    }
    throw err;
  };
  try {
    const out = fn();
    // Async callers: convert a rejection the same way as a synchronous throw.
    return (out instanceof Promise ? out.catch(convert) : out) as T;
  } catch (err) {
    return convert(err);
  }
}

/** A caller's request to record something in an already-struck NAV period. */
export type BackdateRequest = { reason: string | null; confirmed: boolean };

export type BackdateDecision = { isBackdated: boolean; reason: string | null };

export const MIN_BACKDATE_REASON = 10;

/**
 * Backdating = giving a change an accounting date on or before the latest
 * official NAV date, i.e. altering a period whose NAV has already been
 * struck. Only an ADMIN (corrections:backdate) may do it, with a written
 * reason and an explicit confirmation. The struck NAV snapshots themselves
 * are never rewritten; a NAV correction is a separate, explicit step.
 */
export async function decideBackdate(
  db: Db,
  ctx: ServiceCtx,
  effectiveDate: string,
  request: BackdateRequest | null | undefined
): Promise<BackdateDecision> {
  const latest = await latestOfficialNavDate(db, ctx.fundId);
  if (!latest || effectiveDate > latest) return { isBackdated: false, reason: null };

  if (!hasPermission(ctx.actor, "corrections:backdate")) {
    throw new FundError(
      "FORBIDDEN",
      `The NAV for ${latest} is already official. Only a fund administrator can record changes dated on or before it.`,
      403
    );
  }
  const reason = request?.reason?.trim() ?? "";
  if (reason.length < MIN_BACKDATE_REASON || !request?.confirmed) {
    throw validationError(
      `This change is dated on or before the latest official NAV (${latest}). Confirm the correction and give a reason of at least ${MIN_BACKDATE_REASON} characters.`,
      { backdateReason: "Reason and confirmation required" }
    );
  }
  return { isBackdated: true, reason };
}
