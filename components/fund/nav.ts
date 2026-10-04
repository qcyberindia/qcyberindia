// Navigation for a pool workspace. Pure data + helpers (no React) so it can
// be unit-tested. A link is SHOWN only when the member holds the permission;
// this is presentation, the API still authorizes every request.
import type { UiPermission } from "@/components/fund/permissions";

export const POOLS_BASE = "/qfinera/pools";

export function poolBase(poolId: number): string {
  return `${POOLS_BASE}/${poolId}`;
}

export type NavIcon =
  | "dashboard"
  | "members"
  | "contributions"
  | "withdrawals"
  | "trades"
  | "holdings"
  | "watchlist"
  | "expenses"
  | "reports"
  | "audit"
  | "settings"
  | "approvals"
  | "guide";

export type NavItem = { segment: string; label: string; icon: NavIcon; permission: UiPermission };

export const NAV_ITEMS: readonly NavItem[] = [
  { segment: "dashboard", label: "Dashboard", icon: "dashboard", permission: "fund:view" },
  { segment: "members", label: "Members", icon: "members", permission: "members:view_self" },
  { segment: "contributions", label: "Contributions", icon: "contributions", permission: "contributions:view_own" },
  { segment: "withdrawals", label: "Withdrawals", icon: "withdrawals", permission: "withdrawals:view_own" },
  { segment: "trades", label: "Trades", icon: "trades", permission: "trades:view" },
  { segment: "holdings", label: "Positions", icon: "holdings", permission: "holdings:view" },
  { segment: "watchlist", label: "Watchlist", icon: "watchlist", permission: "watchlist:view" },
  { segment: "expenses", label: "Expenses", icon: "expenses", permission: "expenses:view" },
  { segment: "reports", label: "Reports", icon: "reports", permission: "reports:view" },
  { segment: "approvals", label: "Approvals", icon: "approvals", permission: "requests:view" },
  { segment: "audit", label: "Audit", icon: "audit", permission: "audit:view" },
  { segment: "settings", label: "Settings", icon: "settings", permission: "settings:view" },
  { segment: "guide", label: "Guide", icon: "guide", permission: "fund:view" },
];

export function visibleNav(can: (permission: UiPermission) => boolean): NavItem[] {
  return NAV_ITEMS.filter((item) => can(item.permission));
}

/** A section is active for its own path and any child path (e.g. .../trades/12). */
export function isNavActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Absolute path to a record inside a pool section. */
export function recordHref(poolId: number, section: string, id: number | string): string {
  return `${poolBase(poolId)}/${section}/${encodeURIComponent(String(id))}`;
}
