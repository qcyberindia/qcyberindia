// Fund role/permission matrix for QFinera Fund. Pure; no I/O.
//
// Authentication (the qf_session magic-link cookie) answers WHO is calling.
// Authorization answers WHAT that person may do in THIS fund, and is
// decided from their fund_memberships row (role + status) read from the
// database on every request, never from anything the client sends. These
// helpers take that already-loaded membership as input.
//
// Roles, least to most privileged:
//   VIEWER   read-only: sees the pool and its own records; can ask to become
//            a MEMBER (join request). Never creates or changes a record.
//            The one exception is Pool Chat: every active participant,
//            VIEWER included, may read and post in the pool's private chat.
//   MEMBER   own contributions/withdrawals, comments, own watchlist notes.
//   MANAGER  operational: records trades, expenses and contributions for
//            members, and PROPOSES every ADMIN-only change (approvals,
//            corrections, roles, NAV, settings, deletion). A proposal is a
//            pending change request that only an ADMIN can approve; nothing
//            changes until then (lib/fund/services/change-requests.ts).
//   ADMIN    everything, including approving proposals and deleting the pool.

export type FundRole = "ADMIN" | "MANAGER" | "MEMBER" | "VIEWER";

export const FUND_ROLES: readonly FundRole[] = ["ADMIN", "MANAGER", "MEMBER", "VIEWER"];
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
  | "chat:view"
  | "chat:post"
  // VIEWER only
  | "members:request_join"
  // MEMBER and above
  | "watchlist:create"
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
  | "join_requests:review"
  | "requests:view"
  | "requests:create"
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
  | "exports:run"
  | "requests:review"
  | "chat:moderate"
  | "pool:delete";

const VIEWER_PERMISSIONS: readonly FundPermission[] = [
  "fund:view",
  "members:view_self",
  "contributions:view_own",
  "withdrawals:view_own",
  "trades:view",
  "holdings:view",
  "nav:view",
  "watchlist:view",
  "reports:view",
  // Pool Chat is open to every active participant, VIEWER included.
  "chat:view",
  "chat:post",
];

const MEMBER_PERMISSIONS: readonly FundPermission[] = [
  ...VIEWER_PERMISSIONS,
  "contributions:create_own",
  "withdrawals:create_own",
  "watchlist:comment",
  "watchlist:create",
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
  "join_requests:review",
  "requests:view",
  "requests:create",
  // read-only parity with ADMIN, so a MANAGER can prepare informed requests
  "audit:view",
  "settings:view",
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
  "settings:manage",
  "corrections:backdate",
  "exports:run",
  "requests:review",
  "chat:moderate",
  "pool:delete",
];

const ROLE_PERMISSIONS: Record<FundRole, ReadonlySet<FundPermission>> = {
  VIEWER: new Set([...VIEWER_PERMISSIONS, "members:request_join"]),
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

/** ADMIN may invite any role; MANAGER may invite MEMBER or VIEWER only (a
 * manager must not be able to mint admins or peers); others may not invite. */
export function canInviteRole(actor: FundActor, invited: FundRole): boolean {
  if (!hasPermission(actor, "members:invite")) return false;
  return actor.role === "ADMIN" || invited === "MEMBER" || invited === "VIEWER";
}

/**
 * ADMIN-only permissions a MANAGER may PROPOSE as a change request. The
 * change happens only when an ADMIN approves it, and the approving ADMIN's
 * own permissions are checked again at that moment.
 */
export const PROPOSABLE_PERMISSIONS: ReadonlySet<FundPermission> = new Set<FundPermission>([
  "members:change_role",
  "members:suspend",
  "contributions:confirm_funds",
  "contributions:approve",
  "withdrawals:approve",
  "trades:reverse",
  "trades:correct",
  "nav:finalize",
  "expenses:approve",
  "settings:manage",
  "pool:delete",
]);

/** May this actor propose (not perform) an action that needs `permission`? */
export function canPropose(actor: FundActor, permission: FundPermission): boolean {
  return !hasPermission(actor, permission) && hasPermission(actor, "requests:create") && PROPOSABLE_PERMISSIONS.has(permission);
}

/** Roles ordered by privilege, for "is this a promotion?" checks. */
export function roleRank(role: FundRole): number {
  return { VIEWER: 0, MEMBER: 1, MANAGER: 2, ADMIN: 3 }[role];
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
