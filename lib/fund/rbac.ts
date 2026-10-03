// Fund role/permission matrix for QFinera Fund. Pure; no I/O.
//
// Authentication (the qf_session magic-link cookie) answers WHO is calling.
// Authorization answers WHAT that person may do in THIS fund, and is
// decided from their fund_memberships row (role + status) read from the
// database on every request, never from anything the client sends. These
// helpers take that already-loaded membership as input.
//
// Money-movement approvals, trade reversal/backdating, NAV finalization,
// settings, audit access, and corrections are ADMIN-only. MANAGER is
// operational: it can record and view, but cannot approve or correct.

export type FundRole = "ADMIN" | "MANAGER" | "MEMBER";
export type FundMembershipStatus = "active" | "suspended" | "removed";

export type FundPermission =
  // everyone with an active membership
  | "fund:view"
  | "members:view_self"
  | "contributions:view_own"
  | "contributions:create_own"
  | "withdrawals:view_own"
  | "withdrawals:create_own"
  | "trades:view"
  | "holdings:view"
  | "nav:view"
  | "watchlist:view"
  | "watchlist:comment"
  | "reports:view"
  // operational (MANAGER and ADMIN)
  | "members:view_all"
  | "members:invite"
  | "contributions:view_all"
  | "contributions:create_for_member"
  | "withdrawals:view_all"
  | "withdrawals:create_for_member"
  | "trades:create"
  | "watchlist:write"
  | "expenses:view"
  | "expenses:create"
  // ADMIN only
  | "members:change_role"
  | "members:suspend"
  | "contributions:confirm_funds"
  | "contributions:approve"
  | "withdrawals:approve"
  | "trades:reverse"
  | "trades:backdate"
  | "trades:correct"
  | "nav:finalize"
  | "expenses:approve"
  | "audit:view"
  | "settings:view"
  | "settings:manage"
  | "corrections:backdate"
  | "exports:run";

const MEMBER_PERMISSIONS: readonly FundPermission[] = [
  "fund:view",
  "members:view_self",
  "contributions:view_own",
  "contributions:create_own",
  "withdrawals:view_own",
  "withdrawals:create_own",
  "trades:view",
  "holdings:view",
  "nav:view",
  "watchlist:view",
  "watchlist:comment",
  "reports:view",
];

const MANAGER_EXTRA: readonly FundPermission[] = [
  "members:view_all",
  "members:invite",
  "contributions:view_all",
  "contributions:create_for_member",
  "withdrawals:view_all",
  "withdrawals:create_for_member",
  "trades:create",
  "watchlist:write",
  "expenses:view",
  "expenses:create",
];

const ADMIN_EXTRA: readonly FundPermission[] = [
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

const ROLE_PERMISSIONS: Record<FundRole, ReadonlySet<FundPermission>> = {
  MEMBER: new Set(MEMBER_PERMISSIONS),
  MANAGER: new Set([...MEMBER_PERMISSIONS, ...MANAGER_EXTRA]),
  ADMIN: new Set([...MEMBER_PERMISSIONS, ...MANAGER_EXTRA, ...ADMIN_EXTRA]),
};

/** A fund_memberships row, loaded server-side for the authenticated user. */
export type FundActor = {
  userId: number;
  role: FundRole;
  status: FundMembershipStatus;
};

export class ForbiddenError extends Error {
  constructor(message = "You do not have permission to perform this action.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/** Role-only check (ignores membership status). Prefer hasPermission. */
export function can(role: FundRole, permission: FundPermission): boolean {
  return ROLE_PERMISSIONS[role].has(permission);
}

/** A suspended membership has no permissions at all. */
export function hasPermission(actor: FundActor, permission: FundPermission): boolean {
  return actor.status === "active" && can(actor.role, permission);
}

export function assertPermission(actor: FundActor, permission: FundPermission): void {
  if (!hasPermission(actor, permission)) throw new ForbiddenError();
}

/** ADMIN may invite any role; MANAGER may invite MEMBER only (a manager
 * must not be able to mint admins or peers); MEMBER may not invite. */
export function canInviteRole(actor: FundActor, invited: FundRole): boolean {
  if (!hasPermission(actor, "members:invite")) return false;
  return actor.role === "ADMIN" || invited === "MEMBER";
}

export type MemberRecordScope = "profile" | "contributions" | "withdrawals";

const VIEW_ALL: Record<MemberRecordScope, FundPermission> = {
  profile: "members:view_all",
  contributions: "contributions:view_all",
  withdrawals: "withdrawals:view_all",
};

const VIEW_OWN: Record<MemberRecordScope, FundPermission> = {
  profile: "members:view_self",
  contributions: "contributions:view_own",
  withdrawals: "withdrawals:view_own",
};

/** Object-level check (IDOR/BOLA): may this actor see a record that belongs
 * to `ownerUserId`? Privileged roles see everyone's; a MEMBER sees only
 * their own. The owner id must come from the database row, never from the
 * request. */
export function canViewMemberRecord(
  actor: FundActor,
  ownerUserId: number,
  scope: MemberRecordScope
): boolean {
  if (hasPermission(actor, VIEW_ALL[scope])) return true;
  return hasPermission(actor, VIEW_OWN[scope]) && actor.userId === ownerUserId;
}

/** Every permission this actor holds right now (empty unless the membership is active). */
export function permissionsOf(actor: FundActor): FundPermission[] {
  return actor.status === "active" ? [...ROLE_PERMISSIONS[actor.role]] : [];
}
