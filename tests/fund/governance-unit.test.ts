// Pure parts of the governance features: the manager-approval action
// registry, pool deletion confirmation/retention, and the purge plan.
import { describe, expect, it } from "vitest";
import { PROPOSABLE_PERMISSIONS, can } from "../../lib/fund/rbac";
import { FUND_ACTIONS, actionDef } from "../../lib/fund/services/change-requests";
import { DELETION_RETENTION_DAYS, confirmationMatches, purgeDate } from "../../lib/fund/services/pool-deletion";
import { PURGE_STEPS } from "../../lib/fund/pool-purge";
import { FundError } from "../../lib/fund/errors";

describe("approval action registry", () => {
  it("every action needs an ADMIN-only permission that a MANAGER may propose", () => {
    for (const [key, def] of Object.entries(FUND_ACTIONS)) {
      expect(PROPOSABLE_PERMISSIONS.has(def.permission), key).toBe(true);
      expect(can("ADMIN", def.permission), key).toBe(true);
      expect(can("MANAGER", def.permission), key).toBe(false);
    }
  });

  it("covers role, accounting, NAV, settings and deletion changes", () => {
    for (const key of [
      "member.update",
      "contribution.approve",
      "contribution.reject",
      "withdrawal.approve",
      "trade.reverse",
      "trade.correct",
      "expense.approve",
      "nav.finalize",
      "settings.update",
      "pool.delete",
    ]) {
      expect(FUND_ACTIONS[key], key).toBeDefined();
    }
  });

  it("validates a proposal's body before anything is stored", () => {
    expect(() => actionDef("trade.reverse").parse({ reason: "short" })).toThrow(FundError);
    expect(actionDef("trade.reverse").parse({ reason: "Wrong instrument booked", confirm: true })).toEqual({
      reason: "Wrong instrument booked",
      confirm: true,
    });
    expect(() => actionDef("member.update").parse({ role: "OWNER" })).toThrow(FundError);
    expect(() => actionDef("member.update").parse({})).toThrow(FundError);
    expect(actionDef("member.update").parse({ role: "VIEWER" })).toMatchObject({ role: "VIEWER" });
    expect(() => actionDef("settings.update").parse({})).toThrow(FundError);
    expect(() => actionDef("unknown.action")).toThrow(FundError);
  });

  it("withdrawal charges are stored as a decimal string, never a float", () => {
    expect(actionDef("withdrawal.approve").parse({ charges: "12.50" })).toEqual({ charges: "12.50" });
    expect(actionDef("withdrawal.approve").parse({})).toEqual({ charges: "0.00" });
  });

  it("a caller cannot smuggle a join request link into a member change", () => {
    // joinRequestId must be an integer; anything else is dropped.
    expect(actionDef("member.update").parse({ role: "MEMBER", joinRequestId: "7" })).not.toHaveProperty("joinRequestId");
  });
});

describe("pool deletion", () => {
  it("requires typing the exact pool name", () => {
    expect(confirmationMatches("Family Pool", "Family Pool")).toBe(true);
    expect(confirmationMatches("Family Pool", "  Family Pool ")).toBe(true);
    expect(confirmationMatches("Family Pool", "family pool")).toBe(false);
    expect(confirmationMatches("Family Pool", "")).toBe(false);
  });

  it("keeps everything for 30 days", () => {
    expect(DELETION_RETENTION_DAYS).toBe(30);
    const deleted = new Date("2026-10-01T10:00:00Z");
    expect(purgeDate(deleted).toISOString()).toBe("2026-10-31T10:00:00.000Z");
  });

  it("purges children before parents and the pool row last, every step scoped to one pool", () => {
    const tables = PURGE_STEPS.map((s) => s.table);
    expect(tables.at(-1)).toBe("qfinera_funds");
    const before = (a: string, b: string) => expect(tables.indexOf(a), `${a} before ${b}`).toBeLessThan(tables.indexOf(b));
    before("qfinera_fund_watchlist_comments", "qfinera_fund_watchlist_items");
    before("qfinera_fund_contribution_proofs", "qfinera_fund_contributions");
    before("qfinera_fund_trade_revisions", "qfinera_fund_trades");
    before("qfinera_fund_contributions", "qfinera_fund_nav_snapshots");
    before("qfinera_fund_withdrawals", "qfinera_fund_memberships");
    before("qfinera_fund_join_requests", "qfinera_change_requests");
    before("qfinera_fund_join_requests", "qfinera_fund_memberships");
    for (const s of PURGE_STEPS) expect(s.sql, s.table).toMatch(/\$1/);
  });
});
