// Compatibility layer for code written against the original QFinance
// Community auth. Sign-in is now email + password with server-side sessions
// (lib/qfinera-auth); the old stateless magic-link tokens are no longer
// accepted. SessionPayload keeps its shape so existing callers are unchanged
// apart from awaiting the lookup.
import { getRequestSession, getServerSession } from "@/lib/qfinera-auth/http";
import type { AuthSession } from "@/lib/qfinera-auth/sessions";

export { SESSION_COOKIE } from "@/lib/qfinera-auth/sessions";

export type SessionPayload = { userId: number; email: string; displayName: string; exp: number; sessionId: number };

function toPayload(s: AuthSession | null): SessionPayload | null {
  return s
    ? { userId: s.userId, email: s.email, displayName: s.displayName, exp: s.expiresAt.getTime(), sessionId: s.sessionId }
    : null;
}

/** API routes: the signed-in user, or null. Callers respond 401 and never trust a client-supplied user id. */
export async function getQFinanceSessionFromRequest(req: {
  cookies: { get(name: string): { value: string } | undefined };
}): Promise<SessionPayload | null> {
  return toPayload(await getRequestSession(req));
}

/** Server Components: the signed-in user, or null. */
export async function getQFinanceServerSession(): Promise<SessionPayload | null> {
  return toPayload(await getServerSession());
}
