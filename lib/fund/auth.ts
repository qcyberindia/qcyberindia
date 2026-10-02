// Fund access control: authenticated user -> fund membership -> RBAC.
//
// Identity is the QFinera server-side session (lib/qfinera-auth: qf_sid
// cookie -> qfinance_sessions); the canonical user is qfinance_users.id.
// There is no second user or auth system. The session only says WHO is
// calling. WHAT they may do is decided here from the database, on every
// request, from qfinera_fund_memberships (role + status):
//
//   * The fund id from a URL/body is only a REQUEST. A caller who is not a
//     member of that fund gets "not found" (no existence leak).
//   * A suspended user or suspended membership has no permissions.
//   * Roles are never read from the client.
import type { SessionPayload } from "@/lib/qfinance-community-auth";
import { getRequestSession, getServerSession } from "@/lib/qfinera-auth/http";
import type { AuthSession } from "@/lib/qfinera-auth/sessions";
import { readDb, one, type Db } from "@/lib/fund/db";
import {
  FundError,
  notFoundError,
  unauthenticatedError,
} from "@/lib/fund/errors";
import {
  assertPermission,
  hasPermission,
  type FundActor,
  type FundPermission,
  type FundRole,
} from "@/lib/fund/rbac";

export type FundSummary = {
  id: number;
  name: string;
  currency: string;
  initialNav: string;
  status: "active" | "closed";
};

export type FundContext = {
  userId: number;
  email: string;
  displayName: string;
  fund: FundSummary;
  actor: FundActor;
  /** Every fund this user belongs to (for the fund selector). */
  funds: Array<{ id: number; name: string; role: FundRole }>;
};

type MembershipRow = {
  fund_id: number;
  name: string;
  currency: string;
  initial_nav: string;
  fund_status: "active" | "closed";
  role: FundRole;
  membership_status: "active" | "suspended";
  // removed memberships are excluded by the query: a removed member is not a member.
};

async function loadUserStatus(db: Db, userId: number): Promise<"active" | "suspended" | null> {
  const row = await one<{ status: "active" | "suspended" }>(
    db,
    "SELECT status FROM qfinance_users WHERE id = $1",
    [userId]
  );
  return row?.status ?? null;
}

/**
 * Resolves the fund context for an already-verified session. Returns null
 * when the user has no membership in the requested fund (or any fund).
 */
export async function resolveFundContext(
  session: SessionPayload,
  requestedFundId?: number | null,
  db: Db = readDb()
): Promise<FundContext | null> {
  const userStatus = await loadUserStatus(db, session.userId);
  if (userStatus !== "active") return null;

  const { rows } = await db.query<MembershipRow>(
    `SELECT m.fund_id, f.name, f.currency, f.initial_nav, f.status AS fund_status,
            m.role, m.status AS membership_status
       FROM qfinera_fund_memberships m
       JOIN qfinera_funds f ON f.id = m.fund_id
      WHERE m.user_id = $1 AND m.status <> 'removed'
      ORDER BY m.fund_id`,
    [session.userId]
  );
  if (rows.length === 0) return null;

  const chosen = requestedFundId ? rows.find((r) => r.fund_id === requestedFundId) : rows[0];
  if (!chosen) return null;

  return {
    userId: session.userId,
    email: session.email,
    displayName: session.displayName,
    fund: {
      id: chosen.fund_id,
      name: chosen.name,
      currency: chosen.currency,
      initialNav: chosen.initial_nav,
      status: chosen.fund_status,
    },
    actor: { userId: session.userId, role: chosen.role, status: chosen.membership_status },
    funds: rows.map((r) => ({ id: r.fund_id, name: r.name, role: r.role })),
  };
}

type CookieReader = { cookies: { get(name: string): { value: string } | undefined } };

/** API-route entry point. Throws a FundError the route converts to HTTP. */
export async function requireFundContext(
  req: CookieReader,
  requestedFundId?: number | null
): Promise<FundContext> {
  const session = toPayload(await getRequestSession(req));
  if (!session) throw unauthenticatedError();
  const ctx = await resolveFundContext(session, requestedFundId);
  if (!ctx) throw notFoundError("Fund");
  if (ctx.actor.status !== "active") {
    throw new FundError("FORBIDDEN", "Your membership of this fund is suspended.", 403);
  }
  return ctx;
}

/** API-route entry point that also checks one permission. */
export async function requireFundPermission(
  req: CookieReader,
  permission: FundPermission,
  requestedFundId?: number | null
): Promise<FundContext> {
  const ctx = await requireFundContext(req, requestedFundId);
  assertPermission(ctx.actor, permission);
  return ctx;
}

export type PageContext =
  | { state: "unauthenticated" }
  | { state: "no-membership"; displayName: string }
  | { state: "suspended"; displayName: string }
  | { state: "ok"; ctx: FundContext };

/** Server-component entry point; never throws for the expected states. */
export async function loadPageContext(requestedFundId?: number | null): Promise<PageContext> {
  const session = toPayload(await getServerSession());
  if (!session) return { state: "unauthenticated" };
  const ctx = await resolveFundContext(session, requestedFundId);
  if (!ctx) return { state: "no-membership", displayName: session.displayName };
  if (ctx.actor.status !== "active") return { state: "suspended", displayName: session.displayName };
  return { state: "ok", ctx };
}

export function can(ctx: FundContext, permission: FundPermission): boolean {
  return hasPermission(ctx.actor, permission);
}

/** Parses ?fund=ID from search params without trusting it. */
export function parseFundParam(value: string | string[] | undefined | null): number | null {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw && /^\d{1,9}$/.test(raw) ? Number(raw) : null;
}

/**
 * Session only (no pool yet): for creating a pool, listing my pools and
 * accepting an invite. The account must exist and be active.
 */
export async function requireActiveSession(req: CookieReader): Promise<SessionPayload> {
  // getRequestSession only returns sessions of ACTIVE accounts.
  const session = toPayload(await getRequestSession(req));
  if (!session) throw unauthenticatedError();
  return session;
}

function toPayload(s: AuthSession | null): SessionPayload | null {
  return s
    ? { userId: s.userId, email: s.email, displayName: s.displayName, exp: s.expiresAt.getTime(), sessionId: s.sessionId }
    : null;
}
