import { describe, expect, it } from "vitest";
import {
  FUND_ROLES,
  ForbiddenError,
  PROPOSABLE_PERMISSIONS,
  assertPermission,
  can,
  canInviteRole,
  canPropose,
  canViewMemberRecord,
  hasPermission,
  permissionsOf,
  roleRank,
  type FundActor,
  type FundPermission,
} from "../../lib/fund/rbac";

const admin: FundActor = { userId: 1, role: "ADMIN", status: "active" };
const manager: FundActor = { userId: 2, role: "MANAGER", status: "active" };
const member: FundActor = { userId: 3, role: "MEMBER", status: "active" };
const viewer: FundActor = { userId: 4, role: "VIEWER", status: "active" };
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
  "settings:manage",
  "corrections:backdate",
  "exports:run",
  "requests:review",
  "chat:moderate",
  "pool:delete",
];

describe("role matrix", () => {
  it("ADMIN has every ADMIN-only permission; MANAGER, MEMBER and VIEWER have none of them", () => {
    for (const p of ADMIN_ONLY) {
      expect(can("ADMIN", p), `ADMIN ${p}`).toBe(true);
      expect(can("MANAGER", p), `MANAGER ${p}`).toBe(false);
      expect(can("MEMBER", p), `MEMBER ${p}`).toBe(false);
      expect(can("VIEWER", p), `VIEWER ${p}`).toBe(false);
    }
  });

  it("MANAGER can read the audit log and settings (to prepare requests) but not change settings", () => {
    expect(can("MANAGER", "audit:view")).toBe(true);
    expect(can("MANAGER", "settings:view")).toBe(true);
    expect(can("MANAGER", "settings:manage")).toBe(false);
    expect(can("MEMBER", "audit:view")).toBe(false);
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
    expect(can("MEMBER", "watchlist:create")).toBe(true);
    expect(can("MEMBER", "watchlist:comment")).toBe(true);
    expect(can("MEMBER", "members:request_join")).toBe(false);
  });

  it("VIEWER only reads: no create, no comment, no money movement; can ask to join", () => {
    const writes: FundPermission[] = [
      "contributions:create_own",
      "withdrawals:create_own",
      "watchlist:comment",
      "watchlist:create",
      "watchlist:write",
      "trades:create",
      "expenses:create",
      "members:invite",
      "requests:create",
      "join_requests:review",
    ];
    for (const p of writes) expect(can("VIEWER", p), `VIEWER ${p}`).toBe(false);
    for (const p of ["fund:view", "trades:view", "holdings:view", "nav:view", "reports:view", "contributions:view_own"] as const) {
      expect(can("VIEWER", p), `VIEWER ${p}`).toBe(true);
    }
    expect(can("VIEWER", "members:request_join")).toBe(true);
    expect(can("VIEWER", "contributions:view_all")).toBe(false);
  });

  it("Pool Chat: every active role, VIEWER included, reads and posts; only ADMIN moderates", () => {
    for (const r of FUND_ROLES) {
      expect(can(r, "chat:view"), `${r} chat:view`).toBe(true);
      expect(can(r, "chat:post"), `${r} chat:post`).toBe(true);
    }
    expect(hasPermission({ userId: 9, role: "VIEWER", status: "suspended" }, "chat:post")).toBe(false);
    expect(can("ADMIN", "chat:moderate")).toBe(true);
    for (const r of ["MANAGER", "MEMBER", "VIEWER"] as const) expect(can(r, "chat:moderate"), r).toBe(false);
  });

  it("every role is in the matrix, ranked by privilege", () => {
    expect(FUND_ROLES).toEqual(["ADMIN", "MANAGER", "MEMBER", "VIEWER"]);
    expect(roleRank("VIEWER")).toBeLessThan(roleRank("MEMBER"));
    expect(roleRank("MEMBER")).toBeLessThan(roleRank("MANAGER"));
    expect(roleRank("MANAGER")).toBeLessThan(roleRank("ADMIN"));
    // Each role holds a strict superset of the role below it, except VIEWER's join request.
    const set = (r: (typeof FUND_ROLES)[number]) => new Set(permissionsOf({ userId: 1, role: r, status: "active" }));
    for (const p of set("VIEWER")) if (p !== "members:request_join") expect(set("MEMBER").has(p), p).toBe(true);
    for (const p of set("MEMBER")) expect(set("MANAGER").has(p), p).toBe(true);
    for (const p of set("MANAGER")) expect(set("ADMIN").has(p), p).toBe(true);
  });
});

describe("manager proposals (admin approval)", () => {
  it("a MANAGER may propose every ADMIN-only change in the proposable list", () => {
    for (const p of PROPOSABLE_PERMISSIONS) expect(canPropose(manager, p), p).toBe(true);
  });

  it("ADMIN acts directly (never proposes); MEMBER and VIEWER cannot propose", () => {
    for (const p of PROPOSABLE_PERMISSIONS) {
      expect(canPropose(admin, p), `admin ${p}`).toBe(false);
      expect(canPropose(member, p), `member ${p}`).toBe(false);
      expect(canPropose(viewer, p), `viewer ${p}`).toBe(false);
    }
  });

  it("backdating and exports cannot be proposed; a suspended manager proposes nothing", () => {
    expect(canPropose(manager, "corrections:backdate")).toBe(false);
    expect(canPropose(manager, "trades:backdate")).toBe(false);
    expect(canPropose(manager, "exports:run")).toBe(false);
    expect(canPropose({ ...manager, status: "suspended" }, "members:change_role")).toBe(false);
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

  it("MANAGER may invite MEMBER or VIEWER only", () => {
    expect(canInviteRole(manager, "MEMBER")).toBe(true);
    expect(canInviteRole(manager, "VIEWER")).toBe(true);
    expect(canInviteRole(manager, "MANAGER")).toBe(false);
    expect(canInviteRole(manager, "ADMIN")).toBe(false);
  });

  it("MEMBER, VIEWER and suspended users may not invite", () => {
    expect(canInviteRole(member, "MEMBER")).toBe(false);
    expect(canInviteRole(viewer, "VIEWER")).toBe(false);
    expect(canInviteRole(suspendedAdmin, "MEMBER")).toBe(false);
  });
});

describe("object-level access (IDOR/BOLA)", () => {
  it("a MEMBER or VIEWER sees their own records and nobody else's", () => {
    for (const actor of [member, viewer]) {
      for (const scope of ["profile", "contributions", "withdrawals"] as const) {
        expect(canViewMemberRecord(actor, actor.userId, scope)).toBe(true);
        expect(canViewMemberRecord(actor, 99, scope)).toBe(false);
      }
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
