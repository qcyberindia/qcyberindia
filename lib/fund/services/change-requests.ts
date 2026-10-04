// Manager -> Admin approval for pool changes.
//
// A MANAGER may PROPOSE any ADMIN-only change listed in FUND_ACTIONS (the
// permission must be in rbac.PROPOSABLE_PERMISSIONS). The proposal stores the
// validated request body; nothing changes. When an ADMIN approves, the very
// same service call the ADMIN would have made directly runs with the ADMIN's
// own ServiceCtx, so every permission, status, NAV and accounting rule is
// enforced again at that moment, by the existing services. No accounting
// logic lives here.
//
// Routes call actOrPropose(): an ADMIN acts, a MANAGER proposes (HTTP 202),
// anyone else gets the service's normal 403.
import { Money } from "@/lib/accounting/money";
import type { RequestMeta } from "@/lib/fund/audit";
import {
  claimChangeRequest,
  closeChangeRequest,
  completeChangeRequest,
  createChangeRequest,
  getChangeRequest,
  releaseChangeRequest,
  type ChangeRequest,
} from "@/lib/fund/change-request-store";
import { one, readDb, type Db } from "@/lib/fund/db";
import { FundError, notFoundError, validationError } from "@/lib/fund/errors";
import { assertPermission, canPropose, hasPermission, ForbiddenError, FUND_ROLES, type FundPermission } from "@/lib/fund/rbac";
import {
  approveContribution,
  cancelContribution,
  confirmContributionFunds,
  finalizeContribution,
  rejectContribution,
} from "@/lib/fund/services/contributions";
import { approveExpense, rejectExpense } from "@/lib/fund/services/expenses";
import { assertNotSelf, loadMembership, updateMember } from "@/lib/fund/services/members";
import { strikeNav } from "@/lib/fund/services/nav";
import { scheduleDeletion } from "@/lib/fund/services/pool-deletion";
import { getSettings, updateSettings, type SettingsPatch } from "@/lib/fund/services/settings";
import { correctTrade, reverseTrade } from "@/lib/fund/services/trades";
import { approveWithdrawal, cancelWithdrawal, finalizeWithdrawal, rejectWithdrawal } from "@/lib/fund/services/withdrawals";
import type { ServiceCtx } from "@/lib/fund/services/types";
import { parseTicket } from "@/lib/fund/trade-ticket";
import {
  parseBackdate,
  parseDecimal,
  parseEnum,
  parseIsoDate,
  parseOptionalDecimal,
  parseOptionalIsoDate,
  parseOptionalText,
  parseText,
  type JsonObject,
} from "@/lib/fund/validation";

type Payload = JsonObject;

export type FundActionDef = {
  /** The ADMIN permission the action needs. */
  permission: FundPermission;
  entityType: "member" | "contribution" | "withdrawal" | "trade" | "expense" | "nav" | "settings" | "pool";
  /** Plain-language name shown in the approvals queue. */
  label: string;
  /** Validates the request body; returns the JSON-safe payload that is stored and later executed. */
  parse: (body: JsonObject) => Payload;
  /** Performs the change with the given (ADMIN's) context. Returns the route's response data. */
  run: (sctx: ServiceCtx, entityId: number | null, payload: Payload) => Promise<unknown>;
  /** Extra checks when a MANAGER proposes (beyond the entity existing in this pool). */
  guard?: (sctx: ServiceCtx, entityId: number | null, payload: Payload) => void;
};

const reasonRequired = (body: JsonObject, min = 3) => parseText(body.reason, "reason", { min, max: 500 });
const reasonOptional = (body: JsonObject) => parseOptionalText(body.reason, "reason", 500);
const asText = (v: unknown): string | null => (typeof v === "string" ? v : null);
const id = (entityId: number | null): number => {
  if (entityId === null) throw notFoundError();
  return entityId;
};

function parseSettingsPatch(body: JsonObject): SettingsPatch {
  const patch: SettingsPatch = {};
  if (body.name !== undefined) patch.name = parseText(body.name, "name", { min: 3, max: 120 });
  if (body.description !== undefined) patch.description = parseOptionalText(body.description, "description", 1000);
  if (body.cutoffTimeIst !== undefined) patch.cutoffTimeIst = parseText(body.cutoffTimeIst, "cutoffTimeIst", { max: 5 });
  if (body.holidays !== undefined) {
    if (!Array.isArray(body.holidays) || !body.holidays.every((h) => typeof h === "string")) {
      throw validationError("Holidays must be a list of dates.", { holidays: "Invalid" });
    }
    patch.holidays = body.holidays as string[];
  }
  if (body.stcgRate !== undefined) patch.stcgRate = parseText(body.stcgRate, "stcgRate", { max: 6 });
  if (body.ltcgRate !== undefined) patch.ltcgRate = parseText(body.ltcgRate, "ltcgRate", { max: 6 });
  if (body.marketDataProvider !== undefined) {
    patch.marketDataProvider = parseText(body.marketDataProvider, "marketDataProvider", { max: 40 });
  }
  return patch;
}

function parseMemberPatch(body: JsonObject): Payload {
  const role = body.role === undefined ? undefined : parseEnum(body.role, "role", FUND_ROLES);
  const status = body.status === undefined ? undefined : parseEnum(body.status, "status", ["active", "suspended", "removed"] as const);
  if (role === undefined && status === undefined) throw validationError("Choose a new role or status.", { role: "Required" });
  const joinRequestId = typeof body.joinRequestId === "number" && Number.isInteger(body.joinRequestId) ? body.joinRequestId : undefined;
  return { role, status, reason: reasonOptional(body), ...(joinRequestId ? { joinRequestId } : {}) };
}

export const FUND_ACTIONS: Record<string, FundActionDef> = {
  "member.update": {
    permission: "members:change_role",
    entityType: "member",
    label: "Change a member's role or status",
    parse: parseMemberPatch,
    run: async (sctx, entityId, p) => ({
      member: await updateMember(sctx, id(entityId), {
        role: p.role as never,
        status: p.status as never,
        reason: asText(p.reason),
      }),
    }),
    guard: (sctx, entityId) => assertNotSelf(sctx, id(entityId)),
  },
  "contribution.approve": {
    permission: "contributions:approve",
    entityType: "contribution",
    label: "Approve a contribution",
    parse: (b) => ({ reason: reasonOptional(b) }),
    run: async (sctx, e, p) => ({ contribution: await approveContribution(sctx, id(e), asText(p.reason)) }),
  },
  "contribution.confirm_funds": {
    permission: "contributions:confirm_funds",
    entityType: "contribution",
    label: "Confirm a contribution's funds were received",
    parse: (b) => ({ reason: reasonOptional(b) }),
    run: (sctx, e, p) => confirmContributionFunds(sctx, id(e), asText(p.reason)),
  },
  "contribution.reject": {
    permission: "contributions:approve",
    entityType: "contribution",
    label: "Reject a contribution",
    parse: (b) => ({ reason: reasonRequired(b) }),
    run: async (sctx, e, p) => ({ contribution: await rejectContribution(sctx, id(e), String(p.reason)) }),
  },
  "contribution.cancel": {
    permission: "contributions:approve",
    entityType: "contribution",
    label: "Cancel a member's contribution",
    parse: (b) => ({ reason: reasonOptional(b) }),
    run: async (sctx, e, p) => ({ contribution: await cancelContribution(sctx, id(e), asText(p.reason)) }),
  },
  "contribution.finalize": {
    permission: "nav:finalize",
    entityType: "contribution",
    label: "Allocate units for a contribution",
    parse: () => ({}),
    run: async (sctx, e) => ({ contribution: await finalizeContribution(sctx, id(e)) }),
  },
  "withdrawal.approve": {
    permission: "withdrawals:approve",
    entityType: "withdrawal",
    label: "Approve a withdrawal",
    parse: (b) => ({
      charges: (parseOptionalDecimal(b.charges, { label: "charges", scale: 2 }) ?? Money.zero()).toDecimalString(2),
    }),
    run: (sctx, e, p) =>
      approveWithdrawal(sctx, id(e), { charges: parseDecimal(asText(p.charges) ?? "0", { label: "charges", scale: 2 }) }),
  },
  "withdrawal.reject": {
    permission: "withdrawals:approve",
    entityType: "withdrawal",
    label: "Reject a withdrawal",
    parse: (b) => ({ reason: reasonRequired(b) }),
    run: async (sctx, e, p) => ({ withdrawal: await rejectWithdrawal(sctx, id(e), String(p.reason)) }),
  },
  "withdrawal.cancel": {
    permission: "withdrawals:approve",
    entityType: "withdrawal",
    label: "Cancel a member's withdrawal",
    parse: (b) => ({ reason: reasonOptional(b) }),
    run: async (sctx, e, p) => ({ withdrawal: await cancelWithdrawal(sctx, id(e), asText(p.reason)) }),
  },
  "withdrawal.finalize": {
    permission: "nav:finalize",
    entityType: "withdrawal",
    label: "Redeem units for a withdrawal",
    parse: () => ({}),
    run: async (sctx, e) => ({ withdrawal: await finalizeWithdrawal(sctx, id(e)) }),
  },
  "trade.reverse": {
    permission: "trades:reverse",
    entityType: "trade",
    label: "Reverse a trade",
    parse: (b) => ({ reason: reasonRequired(b, 10), confirm: b.confirm === true }),
    run: async (sctx, e, p) => ({
      trade: await reverseTrade(sctx, id(e), { reason: String(p.reason), confirmed: p.confirm === true }),
    }),
  },
  "trade.correct": {
    permission: "trades:correct",
    entityType: "trade",
    label: "Correct a trade",
    parse: (b) => {
      const t = b.trade;
      if (!t || typeof t !== "object" || Array.isArray(t)) throw validationError("Send the corrected trade.", { trade: "Required" });
      parseTicket(t as JsonObject); // validate now; parsed again when applied
      return {
        trade: t as JsonObject,
        settlementDate: parseOptionalIsoDate(b.settlementDate, "settlementDate"),
        externalRef: parseOptionalText(b.externalRef, "externalRef", 64),
        notes: parseOptionalText(b.notes, "notes", 1000),
        reason: reasonRequired(b, 10),
        confirm: b.confirm === true,
      };
    },
    run: (sctx, e, p) =>
      correctTrade(sctx, id(e), {
        ...parseTicket(p.trade as JsonObject),
        settlementDate: asText(p.settlementDate),
        externalRef: asText(p.externalRef),
        notes: asText(p.notes),
        reason: String(p.reason),
        confirmed: p.confirm === true,
      }),
  },
  "expense.approve": {
    permission: "expenses:approve",
    entityType: "expense",
    label: "Approve an expense",
    parse: (b) => {
      const backdate = parseBackdate(b);
      return backdate ? { backdateReason: backdate.reason, confirmBackdate: backdate.confirmed } : {};
    },
    run: async (sctx, e, p) => ({ expense: await approveExpense(sctx, id(e), parseBackdate(p)) }),
  },
  "expense.reject": {
    permission: "expenses:approve",
    entityType: "expense",
    label: "Reject an expense",
    parse: (b) => ({ reason: reasonRequired(b) }),
    run: async (sctx, e, p) => ({ expense: await rejectExpense(sctx, id(e), String(p.reason)) }),
  },
  "nav.finalize": {
    permission: "nav:finalize",
    entityType: "nav",
    label: "Strike the official NAV",
    parse: (b) => ({
      date: parseIsoDate(b.date, "date"),
      correctionReason: parseOptionalText(b.correctionReason, "correctionReason", 500),
      confirmCorrection: b.confirmCorrection === true,
    }),
    run: (sctx, _e, p) =>
      strikeNav(sctx, {
        date: String(p.date),
        correctionReason: asText(p.correctionReason),
        confirmCorrection: p.confirmCorrection === true,
      }),
  },
  "settings.update": {
    permission: "settings:manage",
    entityType: "settings",
    label: "Change pool settings",
    parse: (b) => {
      const patch = parseSettingsPatch(b);
      if (Object.keys(patch).length === 0) throw validationError("Nothing to change.");
      return patch as Payload;
    },
    run: async (sctx, _e, p) => ({ settings: await updateSettings(sctx, parseSettingsPatch(p)) }),
  },
  "pool.delete": {
    permission: "pool:delete",
    entityType: "pool",
    label: "Delete the pool (30-day retention)",
    parse: (b) => ({
      confirmName: parseText(b.confirmName, "confirmName", { min: 1, max: 120 }),
      reason: parseOptionalText(b.reason, "reason", 500),
    }),
    run: async (sctx, _e, p) => ({ deletion: await scheduleDeletion(sctx, { confirmName: String(p.confirmName), reason: asText(p.reason) }) }),
  },
};

export type FundActionKey = keyof typeof FUND_ACTIONS;

export function actionDef(action: string): FundActionDef {
  const def = FUND_ACTIONS[action];
  if (!def) throw validationError("Unknown action.");
  return def;
}

/** The record as it is now, scoped to this pool (404 if it is not in it). */
export async function loadBeforeState(db: Db, fundId: number, entityType: FundActionDef["entityType"], entityId: number | null): Promise<Record<string, unknown> | null> {
  const q = async (sql: string) => {
    const row = await one<Record<string, unknown>>(db, sql, [fundId, entityId]);
    if (!row) throw notFoundError();
    return row;
  };
  switch (entityType) {
    case "member": {
      const m = entityId === null ? null : await loadMembership(db, fundId, entityId);
      if (!m || m.status === "removed") throw notFoundError("Member");
      return { display_name: m.display_name, role: m.role, status: m.status };
    }
    case "contribution":
      return q(`SELECT c.id, u.display_name AS member, c.amount::text AS amount, c.status, c.payment_date::text AS payment_date
                  FROM qfinera_fund_contributions c JOIN qfinance_users u ON u.id = c.member_id WHERE c.fund_id = $1 AND c.id = $2`);
    case "withdrawal":
      return q(`SELECT w.id, u.display_name AS member, w.request_type, w.requested_amount::text AS requested_amount,
                       w.requested_units::text AS requested_units, w.status
                  FROM qfinera_fund_withdrawals w JOIN qfinance_users u ON u.id = w.member_id WHERE w.fund_id = $1 AND w.id = $2`);
    case "trade":
      return q(`SELECT t.id, i.symbol, t.side, t.quantity::text AS quantity, t.price::text AS price, t.trade_date::text AS trade_date, t.status
                  FROM qfinera_fund_trades t JOIN qfinera_fund_instruments i ON i.id = t.instrument_id WHERE t.fund_id = $1 AND t.id = $2`);
    case "expense":
      return q(`SELECT id, category, amount::text AS amount, expense_date::text AS expense_date, status
                  FROM qfinera_fund_expenses WHERE fund_id = $1 AND id = $2`);
    case "settings": {
      const s = await getSettings(db, fundId);
      return {
        name: s.fund.name,
        description: s.fund.description,
        cutoff_time_ist: s.nav.cutoffTimeIst,
        holidays: s.nav.holidays,
        stcg_rate: s.taxAssumptions.stcgRate,
        ltcg_rate: s.taxAssumptions.ltcgRate,
      };
    }
    case "nav": {
      const row = await one<{ d: string | null }>(
        db,
        "SELECT MAX(as_of_date)::text AS d FROM qfinera_fund_nav_snapshots WHERE fund_id = $1 AND is_official",
        [fundId]
      );
      return { latest_official_nav_date: row?.d ?? null };
    }
    case "pool": {
      const row = await one<{ name: string }>(db, "SELECT name FROM qfinera_funds WHERE id = $1", [fundId]);
      return { name: row?.name ?? null };
    }
  }
}

/** What a proposal would change, for the reviewer (the payload minus internals). */
function proposedState(action: string, payload: Payload): Record<string, unknown> {
  const rest = { ...payload };
  delete rest.joinRequestId;
  delete rest.confirm;
  return { action, ...rest };
}

export async function proposeChange(sctx: ServiceCtx, action: string, entityId: number | null, body: JsonObject): Promise<ChangeRequest> {
  const def = actionDef(action);
  if (!canPropose(sctx.actor, def.permission)) throw new ForbiddenError();
  const payload = def.parse(body);
  def.guard?.(sctx, entityId, payload);
  const beforeState = await loadBeforeState(readDb(), sctx.fundId, def.entityType, entityId);
  return createChangeRequest({
    scope: "fund",
    fundId: sctx.fundId,
    action,
    entityType: def.entityType,
    entityId,
    payload,
    beforeState,
    proposedState: proposedState(action, payload),
    reason: asText(payload.reason) ?? asText(payload.correctionReason) ?? asText(body.requestNote),
    requestedBy: sctx.actor.userId,
    meta: sctx.meta,
  });
}

export type ActOrProposeResult =
  | { kind: "done"; data: unknown }
  | { kind: "proposed"; request: ChangeRequest };

/**
 * The single entry point routes use for an ADMIN-only change: performed when
 * the caller holds the permission, proposed when the caller is a MANAGER,
 * otherwise the service's own permission check answers (403).
 */
export async function actOrPropose(sctx: ServiceCtx, action: string, entityId: number | null, body: JsonObject): Promise<ActOrProposeResult> {
  const def = actionDef(action);
  if (canPropose(sctx.actor, def.permission)) {
    return { kind: "proposed", request: await proposeChange(sctx, action, entityId, body) };
  }
  return { kind: "done", data: await def.run(sctx, entityId, def.parse(body)) };
}

/** Converts a FundError/ForbiddenError into the message stored on a failed execution. */
function safeMessage(err: unknown): string | null {
  if (err instanceof FundError || err instanceof ForbiddenError) return err.message;
  const violations = (err as { violations?: Array<{ message: string }> } | null)?.violations;
  if (Array.isArray(violations)) return violations.map((v) => v.message).join("; ");
  return null;
}

/** ADMIN approves: the change is applied with the ADMIN's own context. */
export async function approveChangeRequest(sctx: ServiceCtx, requestId: number, reviewReason: string | null): Promise<{ request: ChangeRequest; result: unknown }> {
  assertPermission(sctx.actor, "requests:review");
  const req = await claimChangeRequest("fund", sctx.fundId, requestId, sctx.actor.userId);
  const def = FUND_ACTIONS[req.action];
  let result: unknown;
  try {
    if (!def) throw validationError("This kind of request is no longer supported.");
    if (req.requestedBy === sctx.actor.userId) {
      throw new FundError("FORBIDDEN", "You cannot approve your own request.", 403);
    }
    result = await def.run(sctx, req.entityId, req.payload);
  } catch (err) {
    // The request stays PENDING with the reason, so the admin can fix the
    // underlying problem and approve again, or reject it.
    await releaseChangeRequest(req.id, safeMessage(err) ?? "The change could not be applied.");
    throw err;
  }
  const request = await completeChangeRequest(req, { userId: sctx.actor.userId, meta: sctx.meta }, reviewReason, {
    applied: true,
  });
  return { request, result };
}

/** ADMIN rejects. A linked join request is rejected with it. */
export async function rejectChangeRequest(sctx: ServiceCtx, requestId: number, reason: string): Promise<ChangeRequest> {
  assertPermission(sctx.actor, "requests:review");
  return closeChangeRequest("fund", sctx.fundId, requestId, "REJECTED", { userId: sctx.actor.userId, meta: sctx.meta }, reason, async (db, req) => {
    const joinId = req.payload.joinRequestId;
    if (req.action === "member.update" && typeof joinId === "number") {
      await db.query(
        `UPDATE qfinera_fund_join_requests SET status = 'REJECTED', reviewed_by = $3, reviewed_at = now(), review_reason = $4
          WHERE id = $1 AND fund_id = $2 AND status = 'PENDING'`,
        [joinId, sctx.fundId, sctx.actor.userId, reason]
      );
    }
  });
}

/** The requester withdraws their own proposal. A linked join request goes back to the queue. */
export async function cancelChangeRequest(sctx: ServiceCtx, requestId: number): Promise<ChangeRequest> {
  const req = await getChangeRequest(readDb(), "fund", sctx.fundId, requestId);
  if (req.requestedBy !== sctx.actor.userId) throw notFoundError("Request");
  return closeChangeRequest("fund", sctx.fundId, requestId, "CANCELLED", { userId: sctx.actor.userId, meta: sctx.meta }, null, async (db, r) => {
    await db.query("UPDATE qfinera_fund_join_requests SET change_request_id = NULL WHERE change_request_id = $1 AND status = 'PENDING'", [r.id]);
  });
}

/** Who may see the approvals queue, and whose requests. */
export function requestVisibility(sctx: ServiceCtx): { requestedBy: number | null } {
  if (hasPermission(sctx.actor, "requests:review")) return { requestedBy: null };
  assertPermission(sctx.actor, "requests:view");
  return { requestedBy: sctx.actor.userId };
}

export type { RequestMeta };
