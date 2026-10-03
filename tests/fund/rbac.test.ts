import { describe, expect, it } from "vitest";
import {
  ForbiddenError,
  assertPermission,
  can,
  canInviteRole,
  canViewMemberRecord,
  hasPermission,
  type FundActor,
  type FundPermission,
} from "../../lib/fund/rbac";

const admin: FundActor = { userId: 1, role: "ADMIN", status: "active" };
const manager: FundActor = { userId: 2, role: "MANAGER", status: "active" };
const member: FundActor = { userId: 3, role: "MEMBER", status: "active" };
const suspendedAdmin: FundActor = { userId: 1, role: "ADMIN", status: "suspended" };

const ADMIN_ONLY: FundPermission[] = [
  "members:change_role",
  "members:suspend",
  "contributions:confirm_funds",
  "contributions:approve",
  "withdrawals:approve",
  "trades:reverse",
  "trades:backdate",
  "trades:correct",
  "nav:finalize",
  "expenses:approve",
  "audit:view",
  "settings:view",
  "settings:manage",
  "corrections:backdate",
  "exports:run",
];

describe("role matrix", () => {
  it("ADMIN has every ADMIN-only permission; MANAGER and MEMBER have none of them", () => {
    for (const p of ADMIN_ONLY) {
      expect(can("ADMIN", p), `ADMIN ${p}`).toBe(true);
      expect(can("MANAGER", p), `MANAGER ${p}`).toBe(false);
      expect(can("MEMBER", p), `MEMBER ${p}`).toBe(false);
    }
  });

  it("MANAGER can record trades and expenses but not approve, reverse or backdate", () => {
    expect(can("MANAGER", "trades:create")).toBe(true);
    expect(can("MANAGER", "expenses:create")).toBe(true);
    expect(can("MANAGER", "contributions:create_for_member")).toBe(true);
    expect(can("MANAGER", "contributions:approve")).toBe(false);
    expect(can("MANAGER", "trades:reverse")).toBe(false);
    expect(can("MANAGER", "trades:backdate")).toBe(false);
  });

  it("MEMBER is limited to own records and read-only views", () => {
    expect(can("MEMBER", "contributions:create_own")).toBe(true);
    expect(can("MEMBER", "contributions:view_own")).toBe(true);
    expect(can("MEMBER", "contributions:view_all")).toBe(false);
    expect(can("MEMBER", "trades:create")).toBe(false);
    expect(can("MEMBER", "members:view_all")).toBe(false);
    expect(can("MEMBER", "watchlist:write")).toBe(false);
    expect(can("MEMBER", "watchlist:comment")).toBe(true);
  });
});

describe("membership status", () => {
  it("a suspended membership has no permissions at all, even for ADMIN", () => {
    expect(hasPermission(suspendedAdmin, "fund:view")).toBe(false);
    expect(hasPermission(suspendedAdmin, "contributions:approve")).toBe(false);
  });

  it("assertPermission throws ForbiddenError when denied", () => {
    expect(() => assertPermission(member, "contributions:approve")).toThrow(ForbiddenError);
    expect(() => assertPermission(admin, "contributions:approve")).not.toThrow();
  });
});

describe("inviting", () => {
  it("ADMIN may invite any role", () => {
    expect(canInviteRole(admin, "ADMIN")).toBe(true);
    expect(canInviteRole(admin, "MANAGER")).toBe(true);
    expect(canInviteRole(admin, "MEMBER")).toBe(true);
  });

  it("MANAGER may invite MEMBER only", () => {
    expect(canInviteRole(manager, "MEMBER")).toBe(true);
    expect(canInviteRole(manager, "MANAGER")).toBe(false);
    expect(canInviteRole(manager, "ADMIN")).toBe(false);
  });

  it("MEMBER and suspended users may not invite", () => {
    expect(canInviteRole(member, "MEMBER")).toBe(false);
    expect(canInviteRole(suspendedAdmin, "MEMBER")).toBe(false);
  });
});

describe("object-level access (IDOR/BOLA)", () => {
  it("a MEMBER sees their own records and nobody else's", () => {
    for (const scope of ["profile", "contributions", "withdrawals"] as const) {
      expect(canViewMemberRecord(member, member.userId, scope)).toBe(true);
      expect(canViewMemberRecord(member, 99, scope)).toBe(false);
    }
  });

  it("MANAGER and ADMIN see every member's records", () => {
    for (const actor of [manager, admin]) {
      expect(canViewMemberRecord(actor, 3, "contributions")).toBe(true);
      expect(canViewMemberRecord(actor, 99, "withdrawals")).toBe(true);
      expect(canViewMemberRecord(actor, 99, "profile")).toBe(true);
    }
  });

  it("a suspended actor sees nothing, including their own records", () => {
    expect(canViewMemberRecord(suspendedAdmin, 1, "contributions")).toBe(false);
  });
});
