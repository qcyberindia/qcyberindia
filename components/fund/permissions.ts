// The permissions the UI needs to decide what to SHOW. This is presentation
// only: it hides controls a role cannot use. Every action is re-authorized
// on the server (lib/fund/auth.ts + lib/fund/rbac.ts); hiding a button is
// never the security boundary.
//
// `satisfies` ties every entry to the real FundPermission union, so if the
// RBAC matrix renames a permission this file stops type-checking.
import type { FundPermission } from "@/lib/fund/rbac";

export const UI_PERMISSIONS = [
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
  "members:request_join",
  "watchlist:create",
  "join_requests:review",
  "requests:view",
  "requests:create",
  "requests:review",
  "pool:delete",
  "chat:view",
  "chat:post",
  "chat:moderate",
] as const satisfies readonly FundPermission[];

export type UiPermission = (typeof UI_PERMISSIONS)[number];
